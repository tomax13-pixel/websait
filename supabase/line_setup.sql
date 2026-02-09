-- =============================================================================
-- LINE通知機能 - データベース拡張
-- =============================================================================

-- line_tokens テーブル（LINE連携ユーザー情報）
CREATE TABLE IF NOT EXISTS line_tokens (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS有効化
ALTER TABLE line_tokens ENABLE ROW LEVEL SECURITY;

-- ポリシー：ユーザーは自分のトークンのみ管理可能
DROP POLICY IF EXISTS "Users can manage their own line token" ON line_tokens;
CREATE POLICY "Users can manage their own line token" ON line_tokens
  FOR ALL USING (user_id = auth.uid());

-- オーナーはサークルメンバーのLINE連携状況を確認可能（通知送信のため）
DROP POLICY IF EXISTS "Owners can read circle line tokens" ON line_tokens;
CREATE POLICY "Owners can read circle line tokens" ON line_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      WHERE p1.user_id = auth.uid() AND p1.role = 'owner'
      AND EXISTS (
        SELECT 1 FROM profiles p2
        WHERE p2.user_id = line_tokens.user_id
        AND p2.circle_id = p1.circle_id
      )
    )
  );

-- =============================================================================
-- 完了！
-- =============================================================================
