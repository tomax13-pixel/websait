-- =============================================================================
-- サークル結 - Multi-tenant SaaS Architecture Migration
-- =============================================================================
-- このファイルを Supabase SQL Editor で実行してください。
-- 既存の circles テーブルを organizations に進化させ、RBACを実装します。
-- =============================================================================

-- ===========================
-- 1. 既存ポリシーの削除
-- ===========================

-- profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Circle profiles are readable by members" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- circles
DROP POLICY IF EXISTS "Circles are readable by members" ON circles;

-- events
DROP POLICY IF EXISTS "Events are readable by circle members" ON events;
DROP POLICY IF EXISTS "Owners can manage events" ON events;

-- rsvps
DROP POLICY IF EXISTS "RSVPs are readable by circle members" ON rsvps;
DROP POLICY IF EXISTS "Members can manage their own RSVPs" ON rsvps;

-- payments
DROP POLICY IF EXISTS "Payments are readable by members" ON payments;
DROP POLICY IF EXISTS "Owners can manage payments" ON payments;
DROP POLICY IF EXISTS "Members can insert their own payments" ON payments;
DROP POLICY IF EXISTS "Members can delete their own payments" ON payments;

-- announcements
DROP POLICY IF EXISTS "Announcements are visible to circle members" ON announcements;
DROP POLICY IF EXISTS "Owners can manage announcements" ON announcements;

-- ===========================
-- 2. circles → organizations リネーム + 拡張
-- ===========================

ALTER TABLE circles RENAME TO organizations;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS member_limit INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ===========================
-- 3. organization_members テーブル作成
-- ===========================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- ===========================
-- 4. profiles の circle_id → organization_id リネーム
-- ===========================

ALTER TABLE profiles RENAME COLUMN circle_id TO organization_id;

-- 外部キー制約の更新
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_circle_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- ===========================
-- 5. 既存データの移行（profiles → organization_members）
-- ===========================

INSERT INTO organization_members (organization_id, user_id, role, created_at)
SELECT organization_id, user_id, role, created_at
FROM profiles
WHERE organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ===========================
-- 6. events の circle_id → organization_id リネーム
-- ===========================

ALTER TABLE events RENAME COLUMN circle_id TO organization_id;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_circle_id_fkey;
ALTER TABLE events ADD CONSTRAINT events_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ===========================
-- 7. announcements の circle_id → organization_id リネーム
-- ===========================

ALTER TABLE announcements RENAME COLUMN circle_id TO organization_id;
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_circle_id_fkey;
ALTER TABLE announcements ADD CONSTRAINT announcements_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ===========================
-- 8. owner_invites の circle_id → organization_id リネーム
-- ===========================

ALTER TABLE owner_invites RENAME COLUMN circle_id TO organization_id;
ALTER TABLE owner_invites DROP CONSTRAINT IF EXISTS owner_invites_circle_id_fkey;
ALTER TABLE owner_invites ADD CONSTRAINT owner_invites_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ===========================
-- 9. ヘルパー関数の更新
-- ===========================

-- 古い関数の削除
DROP FUNCTION IF EXISTS get_my_circle_id();

-- ユーザーの組織IDを取得
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ユーザーの組織内ロールを取得
CREATE OR REPLACE FUNCTION get_my_org_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM organization_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ユーザーが管理者権限を持つか確認
CREATE OR REPLACE FUNCTION is_org_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- ===========================
-- 10. 組織作成・参加 RPC の更新
-- ===========================

DROP FUNCTION IF EXISTS create_circle_secure(text);
DROP FUNCTION IF EXISTS join_circle_secure(text);

-- 組織作成用 RPC
CREATE OR REPLACE FUNCTION create_organization_secure(org_name text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  new_code text;
BEGIN
  new_code := upper(substring(md5(random()::text) from 1 for 8));
  
  INSERT INTO organizations (name, join_code, created_by)
  VALUES (org_name, new_code, auth.uid())
  RETURNING id INTO new_id;
  
  -- 作成者を owner として登録
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner');
  
  RETURN jsonb_build_object('id', new_id, 'join_code', new_code, 'name', org_name);
END;
$$;

-- 組織参加用 RPC
CREATE OR REPLACE FUNCTION join_organization_secure(code text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_org organizations%ROWTYPE;
  current_count INTEGER;
BEGIN
  SELECT * INTO found_org FROM organizations WHERE join_code = code;
  
  IF found_org.id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;
  
  -- メンバー数制限チェック
  SELECT COUNT(*) INTO current_count FROM organization_members WHERE organization_id = found_org.id;
  
  IF current_count >= found_org.member_limit THEN
    RAISE EXCEPTION 'Member limit reached. Contact organization owner.';
  END IF;
  
  -- メンバーとして登録
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (found_org.id, auth.uid(), 'member')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN jsonb_build_object('id', found_org.id, 'name', found_org.name);
END;
$$;

-- ===========================
-- 11. Freemium メンバー制限トリガー
-- ===========================

CREATE OR REPLACE FUNCTION check_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  org_limit INTEGER;
  current_count INTEGER;
BEGIN
  SELECT member_limit INTO org_limit FROM organizations WHERE id = NEW.organization_id;
  SELECT COUNT(*) INTO current_count FROM organization_members WHERE organization_id = NEW.organization_id;
  
  IF current_count >= org_limit THEN
    RAISE EXCEPTION 'Member limit (%) reached. Upgrade to Pro plan.', org_limit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_member_limit ON organization_members;
CREATE TRIGGER enforce_member_limit
  BEFORE INSERT ON organization_members
  FOR EACH ROW EXECUTE FUNCTION check_member_limit();

-- ===========================
-- 12. RLS ポリシー（organizations）
-- ===========================

CREATE POLICY "Organizations are readable by members" ON organizations
  FOR SELECT USING (id = get_my_org_id());

-- ===========================
-- 13. RLS ポリシー（organization_members）
-- ===========================

CREATE POLICY "Members can view organization members" ON organization_members
  FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "Admins can manage organization members" ON organization_members
  FOR ALL USING (
    organization_id = get_my_org_id() AND is_org_admin_or_owner()
  );

-- ===========================
-- 14. RLS ポリシー（profiles）
-- ===========================

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Organization profiles are readable by members" ON profiles
  FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "Users can manage own profile" ON profiles
  FOR ALL USING (user_id = auth.uid());

-- ===========================
-- 15. RLS ポリシー（events）
-- ===========================

CREATE POLICY "Events are readable by organization members" ON events
  FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    organization_id = get_my_org_id() AND is_org_admin_or_owner()
  );

-- ===========================
-- 16. RLS ポリシー（rsvps）
-- ===========================

CREATE POLICY "RSVPs are readable by organization members" ON rsvps
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organization_id = get_my_org_id())
  );

CREATE POLICY "Members can manage their own RSVPs" ON rsvps
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===========================
-- 17. RLS ポリシー（payments）
-- ===========================

CREATE POLICY "Payments are readable by members" ON payments
  FOR SELECT USING (
    user_id = auth.uid() OR
    (event_id IN (SELECT id FROM events WHERE organization_id = get_my_org_id()) AND is_org_admin_or_owner())
  );

CREATE POLICY "Admins can manage payments" ON payments
  FOR UPDATE USING (
    event_id IN (SELECT id FROM events WHERE organization_id = get_my_org_id()) AND is_org_admin_or_owner()
  );

CREATE POLICY "Members can insert their own payments" ON payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can delete their own payments" ON payments
  FOR DELETE USING (user_id = auth.uid());

-- ===========================
-- 18. RLS ポリシー（announcements）
-- ===========================

CREATE POLICY "Announcements are visible to organization members" ON announcements
  FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (
    organization_id = get_my_org_id() AND is_org_admin_or_owner()
  );

-- =============================================================================
-- 完了！
-- =============================================================================
