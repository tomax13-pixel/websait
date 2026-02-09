-- =============================================================================
-- 組織情報更新用 RLS ポリシー追加
-- =============================================================================
-- owner/admin が組織名を更新できるようにする

-- 既存のポリシーがあれば削除
DROP POLICY IF EXISTS "Admins can update organization" ON organizations;

-- 管理者が組織情報を更新できるポリシー
CREATE POLICY "Admins can update organization" ON organizations
  FOR UPDATE USING (
    id = get_my_org_id() AND is_org_admin_or_owner()
  );
