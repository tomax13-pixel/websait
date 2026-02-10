-- =============================================================================
-- サークル結 - Circle Management V2 Migration
-- =============================================================================
-- ロール拡張、招待リンク、メンバー台帳強化、イベント拡張、出欠変更履歴
-- =============================================================================

-- ===========================
-- 1. ロール拡張
-- ===========================

-- まず全ての role 関連 CHECK 制約を動的に削除（制約名がDB依存のため）
DO $$
DECLARE
  r RECORD;
BEGIN
  -- organization_members の role 関連 CHECK 制約を全て削除
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'organization_members'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE organization_members DROP CONSTRAINT %I', r.conname);
  END LOOP;

  -- profiles の role 関連 CHECK 制約を全て削除
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'profiles'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- organization_members の既存データをマイグレーション（制約なしの状態で実行）
UPDATE organization_members SET role = 'representative' WHERE role IN ('owner', 'admin');
UPDATE organization_members SET role = 'member' WHERE role NOT IN ('representative', 'accountant', 'publicity', 'member');

-- organization_members の新しい role 制約を追加
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('representative', 'accountant', 'publicity', 'member'));

-- profiles の既存データをマイグレーション（制約なしの状態で実行）
UPDATE profiles SET role = 'representative' WHERE role IN ('owner', 'admin');
UPDATE profiles SET role = 'member' WHERE role NOT IN ('representative', 'accountant', 'publicity', 'member') AND role IS NOT NULL;

-- profiles の新しい role 制約を追加
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('representative', 'accountant', 'publicity', 'member'));

-- ===========================
-- 2. 招待リンクテーブル
-- ===========================

CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email_domain TEXT,              -- NULL = 制限なし, 例: 'university.ac.jp'
  max_uses INTEGER,               -- NULL = 無制限
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,         -- NULL = 無期限
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- RLS: 同じ組織のメンバーだけが見れる
CREATE POLICY "Invite links are readable by org members" ON invite_links
  FOR SELECT USING (organization_id = get_my_org_id());

-- RLS: 代表・会計のみ管理可能
CREATE POLICY "Managers can manage invite links" ON invite_links
  FOR ALL USING (
    organization_id = get_my_org_id()
    AND (SELECT role FROM organization_members WHERE user_id = auth.uid() AND organization_id = invite_links.organization_id) IN ('representative')
  );

-- ===========================
-- 3. メンバー台帳拡張
-- ===========================

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS grade TEXT CHECK (grade IN ('B1','B2','B3','B4','M1','M2','D1','D2','D3','other')),
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS joined_at DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('active', 'on_leave', 'withdrawn'));

-- ===========================
-- 4. イベント拡張
-- ===========================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS cancel_policy TEXT CHECK (cancel_policy IN ('free', 'deadline_only', 'penalty')),
  ADD COLUMN IF NOT EXISTS cancel_fee INTEGER DEFAULT 0;

-- ===========================
-- 5. 出欠変更履歴テーブル
-- ===========================

CREATE TABLE IF NOT EXISTS rsvp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_reason TEXT
);

ALTER TABLE rsvp_history ENABLE ROW LEVEL SECURITY;

-- RLS: 同じ組織のイベントの履歴のみ閲覧可能
CREATE POLICY "RSVP history readable by org members" ON rsvp_history
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organization_id = get_my_org_id())
  );

-- ===========================
-- 6. 出欠変更トリガー
-- ===========================

CREATE OR REPLACE FUNCTION record_rsvp_change()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT の場合
  IF TG_OP = 'INSERT' THEN
    INSERT INTO rsvp_history (rsvp_id, event_id, user_id, old_status, new_status)
    VALUES (NEW.id, NEW.event_id, NEW.user_id, NULL, NEW.status);
    RETURN NEW;
  END IF;

  -- UPDATE の場合（ステータスが実際に変更された場合のみ）
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO rsvp_history (rsvp_id, event_id, user_id, old_status, new_status)
    VALUES (NEW.id, NEW.event_id, NEW.user_id, OLD.status, NEW.status);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS rsvp_change_tracker ON rsvps;
CREATE TRIGGER rsvp_change_tracker
  AFTER INSERT OR UPDATE ON rsvps
  FOR EACH ROW EXECUTE FUNCTION record_rsvp_change();

-- ===========================
-- 7. ヘルパー関数の更新
-- ===========================

-- ロール名の更新に伴い管理者チェック関数を更新
CREATE OR REPLACE FUNCTION is_org_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('representative', 'accountant')
  );
$$;

-- ロール毎の権限チェック関数
CREATE OR REPLACE FUNCTION has_org_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  -- 代表は全権限
  IF user_role = 'representative' THEN
    RETURN true;
  END IF;

  -- 会計の権限
  IF user_role = 'accountant' AND permission_name IN ('manage_payments', 'view_members', 'view_stats') THEN
    RETURN true;
  END IF;

  -- 広報の権限
  IF user_role = 'publicity' AND permission_name IN ('manage_announcements', 'manage_events', 'view_members') THEN
    RETURN true;
  END IF;

  -- 一般メンバーの権限
  IF permission_name IN ('view_members', 'rsvp') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ===========================
-- 8. 組織作成RPCの更新
-- ===========================

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
  
  -- 作成者を representative として登録
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_id, auth.uid(), 'representative');
  
  RETURN jsonb_build_object('id', new_id, 'join_code', new_code, 'name', org_name);
END;
$$;

-- ===========================
-- 9. 招待リンクで参加する RPC
-- ===========================

CREATE OR REPLACE FUNCTION join_via_invite_link(invite_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_link invite_links%ROWTYPE;
  found_org organizations%ROWTYPE;
  user_email TEXT;
  current_count INTEGER;
BEGIN
  -- リンクの検証
  SELECT * INTO found_link FROM invite_links
    WHERE token = invite_token AND is_active = true;

  IF found_link.id IS NULL THEN
    RAISE EXCEPTION '無効な招待リンクです';
  END IF;

  -- 有効期限チェック
  IF found_link.expires_at IS NOT NULL AND now() > found_link.expires_at THEN
    RAISE EXCEPTION 'この招待リンクは期限切れです';
  END IF;

  -- 使用回数チェック
  IF found_link.max_uses IS NOT NULL AND found_link.current_uses >= found_link.max_uses THEN
    RAISE EXCEPTION 'この招待リンクは使用上限に達しています';
  END IF;

  -- メールドメインチェック
  IF found_link.email_domain IS NOT NULL THEN
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    IF user_email IS NULL OR user_email NOT LIKE '%@' || found_link.email_domain THEN
      RAISE EXCEPTION 'この招待リンクは %s のメールアドレスが必要です', found_link.email_domain;
    END IF;
  END IF;

  -- 組織情報取得
  SELECT * INTO found_org FROM organizations WHERE id = found_link.organization_id;

  -- メンバー数制限チェック
  SELECT COUNT(*) INTO current_count FROM organization_members
    WHERE organization_id = found_org.id AND membership_status = 'active';

  IF current_count >= found_org.member_limit THEN
    RAISE EXCEPTION 'メンバー上限に達しています。管理者にお問い合わせください。';
  END IF;

  -- メンバーとして登録
  INSERT INTO organization_members (organization_id, user_id, role, membership_status)
  VALUES (found_org.id, auth.uid(), 'member', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- 使用回数更新
  UPDATE invite_links SET current_uses = current_uses + 1 WHERE id = found_link.id;

  RETURN jsonb_build_object('id', found_org.id, 'name', found_org.name);
END;
$$;

-- ===========================
-- 10. 運営指標ビュー
-- ===========================

CREATE OR REPLACE VIEW member_stats AS
SELECT
  om.id AS member_id,
  om.organization_id,
  om.user_id,
  om.role,
  om.grade,
  om.position,
  om.membership_status,
  om.joined_at,
  p.display_name,
  -- 出欠率（直近のイベントに対する参加率）
  COALESCE(
    ROUND(
      COUNT(CASE WHEN r.status = 'yes' THEN 1 END)::NUMERIC /
      NULLIF(COUNT(r.id), 0) * 100, 1
    ), 0
  ) AS attendance_rate,
  -- 未払い件数
  COALESCE(
    (SELECT COUNT(*) FROM payments pay
     JOIN events ev ON pay.event_id = ev.id
     WHERE pay.user_id = om.user_id
       AND ev.organization_id = om.organization_id
       AND pay.status = 'unpaid'),
    0
  ) AS unpaid_count,
  -- 総イベント数（RSVP対象）
  COUNT(r.id) AS total_rsvps,
  -- 参加回数
  COUNT(CASE WHEN r.status = 'yes' THEN 1 END) AS attended_count
FROM organization_members om
LEFT JOIN profiles p ON p.user_id = om.user_id
LEFT JOIN events e ON e.organization_id = om.organization_id
LEFT JOIN rsvps r ON r.event_id = e.id AND r.user_id = om.user_id
GROUP BY om.id, om.organization_id, om.user_id, om.role, om.grade,
         om.position, om.membership_status, om.joined_at, p.display_name;

-- ===========================
-- 11. 組織参加RPCの更新（roleをrepresentativeに）
-- ===========================

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
  SELECT COUNT(*) INTO current_count FROM organization_members
    WHERE organization_id = found_org.id AND membership_status = 'active';
  
  IF current_count >= found_org.member_limit THEN
    RAISE EXCEPTION 'Member limit reached. Contact organization owner.';
  END IF;
  
  -- メンバーとして登録
  INSERT INTO organization_members (organization_id, user_id, role, membership_status)
  VALUES (found_org.id, auth.uid(), 'member', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN jsonb_build_object('id', found_org.id, 'name', found_org.name);
END;
$$;

-- =============================================================================
-- 完了！
-- =============================================================================
