-- =============================================================================
-- サークル結 - Simplified Role System Migration
-- =============================================================================
-- 4ロール体制(representative/accountant/publicity/member)から
-- 3ロール体制(owner/admin/member)に簡略化
-- =============================================================================

-- ===========================
-- 1. 既存のロール制約を削除
-- ===========================

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

-- ===========================
-- 2. 既存データのマイグレーション
-- ===========================

-- organization_members
UPDATE organization_members SET role = 'owner' WHERE role = 'representative';
UPDATE organization_members SET role = 'admin' WHERE role IN ('accountant', 'publicity');
-- 'member' はそのまま

-- profiles
UPDATE profiles SET role = 'owner' WHERE role = 'representative';
UPDATE profiles SET role = 'admin' WHERE role IN ('accountant', 'publicity');
-- 'member' はそのまま

-- ===========================
-- 3. 新しいロール制約を追加
-- ===========================

ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

-- ===========================
-- 4. ヘルパー関数の更新
-- ===========================

-- 管理者チェック関数
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

  -- owner は全権限
  IF user_role = 'owner' THEN
    RETURN true;
  END IF;

  -- admin の権限（イベント管理、支払い管理、メンバー閲覧、統計閲覧、お知らせ管理）
  IF user_role = 'admin' AND permission_name IN (
    'manage_events', 'manage_payments', 'manage_announcements',
    'view_members', 'view_stats'
  ) THEN
    RETURN true;
  END IF;

  -- member の権限（閲覧、出欠のみ）
  IF permission_name IN ('view_members', 'rsvp') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ===========================
-- 5. 組織作成RPCの更新
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
  
  -- 作成者を owner として登録
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner');
  
  RETURN jsonb_build_object('id', new_id, 'join_code', new_code, 'name', org_name);
END;
$$;

-- ===========================
-- 6. 組織参加RPCの更新
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
  
  -- member として登録
  INSERT INTO organization_members (organization_id, user_id, role, membership_status)
  VALUES (found_org.id, auth.uid(), 'member', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN jsonb_build_object('id', found_org.id, 'name', found_org.name);
END;
$$;

-- ===========================
-- 7. 招待リンク参加RPCの更新
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
  SELECT * INTO found_link FROM invite_links
    WHERE token = invite_token AND is_active = true;

  IF found_link.id IS NULL THEN
    RAISE EXCEPTION '無効な招待リンクです';
  END IF;

  IF found_link.expires_at IS NOT NULL AND now() > found_link.expires_at THEN
    RAISE EXCEPTION 'この招待リンクは期限切れです';
  END IF;

  IF found_link.max_uses IS NOT NULL AND found_link.current_uses >= found_link.max_uses THEN
    RAISE EXCEPTION 'この招待リンクは使用上限に達しています';
  END IF;

  IF found_link.email_domain IS NOT NULL THEN
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    IF user_email IS NULL OR user_email NOT LIKE '%@' || found_link.email_domain THEN
      RAISE EXCEPTION 'この招待リンクは %s のメールアドレスが必要です', found_link.email_domain;
    END IF;
  END IF;

  SELECT * INTO found_org FROM organizations WHERE id = found_link.organization_id;

  SELECT COUNT(*) INTO current_count FROM organization_members
    WHERE organization_id = found_org.id AND membership_status = 'active';

  IF current_count >= found_org.member_limit THEN
    RAISE EXCEPTION 'メンバー上限に達しています。管理者にお問い合わせください。';
  END IF;

  -- member として登録
  INSERT INTO organization_members (organization_id, user_id, role, membership_status)
  VALUES (found_org.id, auth.uid(), 'member', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE invite_links SET current_uses = current_uses + 1 WHERE id = found_link.id;

  RETURN jsonb_build_object('id', found_org.id, 'name', found_org.name);
END;
$$;

-- ===========================
-- 8. 招待リンクRLSの更新
-- ===========================

DROP POLICY IF EXISTS "Managers can manage invite links" ON invite_links;
CREATE POLICY "Managers can manage invite links" ON invite_links
  FOR ALL USING (
    organization_id = get_my_org_id()
    AND (SELECT role FROM organization_members WHERE user_id = auth.uid() AND organization_id = invite_links.organization_id) IN ('owner', 'admin')
  );

-- ===========================
-- 9. ロール変更RPC（owner のみ実行可能）
-- ===========================

CREATE OR REPLACE FUNCTION update_member_role(target_user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  caller_org_id UUID;
  target_current_role TEXT;
BEGIN
  -- 呼び出し元のロールと組織IDを取得
  SELECT role, organization_id INTO caller_role, caller_org_id
  FROM organization_members
  WHERE user_id = auth.uid();

  -- owner または admin のみ実行可能
  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'owner または admin のみロール変更が可能です';
  END IF;

  -- 有効なロールかチェック
  IF new_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION '無効なロールです。admin または member を指定してください';
  END IF;

  -- 自分自身のロールは変更不可
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION '自分自身のロールは変更できません';
  END IF;

  -- 対象が同じ組織のメンバーかチェック
  SELECT role INTO target_current_role
  FROM organization_members
  WHERE user_id = target_user_id AND organization_id = caller_org_id;

  IF target_current_role IS NULL THEN
    RAISE EXCEPTION '対象ユーザーは同じ組織に所属していません';
  END IF;

  -- owner のロールは変更不可
  IF target_current_role = 'owner' THEN
    RAISE EXCEPTION 'owner のロールは変更できません';
  END IF;

  -- admin は他の admin のロールを変更不可（owner のみ可能）
  IF caller_role = 'admin' AND target_current_role = 'admin' THEN
    RAISE EXCEPTION '幹部が他の幹部のロールを変更することはできません';
  END IF;

  -- ロール更新（organization_members）
  UPDATE organization_members
  SET role = new_role
  WHERE user_id = target_user_id AND organization_id = caller_org_id;

  -- profiles テーブルも同期
  UPDATE profiles
  SET role = new_role
  WHERE user_id = target_user_id AND organization_id = caller_org_id;
END;
$$;

-- ===========================
-- 10. メンバー削除RPC（owner/admin のみ実行可能）
-- ===========================

CREATE OR REPLACE FUNCTION remove_member(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  caller_org_id UUID;
  target_current_role TEXT;
BEGIN
  SELECT role, organization_id INTO caller_role, caller_org_id
  FROM organization_members
  WHERE user_id = auth.uid();

  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'owner または admin のみメンバー削除が可能です';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION '自分自身を削除することはできません';
  END IF;

  SELECT role INTO target_current_role
  FROM organization_members
  WHERE user_id = target_user_id AND organization_id = caller_org_id;

  IF target_current_role IS NULL THEN
    RAISE EXCEPTION '対象ユーザーは同じ組織に所属していません';
  END IF;

  IF target_current_role = 'owner' THEN
    RAISE EXCEPTION '代表を削除することはできません';
  END IF;

  IF caller_role = 'admin' AND target_current_role = 'admin' THEN
    RAISE EXCEPTION '幹部が他の幹部を削除することはできません';
  END IF;

  -- organization_members から削除
  DELETE FROM organization_members
  WHERE user_id = target_user_id AND organization_id = caller_org_id;

  -- profiles のリセット
  UPDATE profiles
  SET organization_id = NULL, role = 'member'
  WHERE user_id = target_user_id AND organization_id = caller_org_id;
END;
$$;

-- =============================================================================
-- 完了！
-- =============================================================================
