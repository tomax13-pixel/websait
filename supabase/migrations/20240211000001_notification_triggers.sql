-- =============================================================================
-- Announcement 通知トリガー
-- =============================================================================
-- お知らせ投稿時に組織メンバーへ通知

-- 通知送信用関数（Edge Functionを呼び出す）
CREATE OR REPLACE FUNCTION notify_on_announcement()
RETURNS TRIGGER AS $$
DECLARE
  member_ids UUID[];
BEGIN
  -- 投稿者以外の組織メンバーのIDを取得
  SELECT array_agg(user_id) INTO member_ids
  FROM organization_members
  WHERE organization_id = NEW.organization_id
    AND user_id != NEW.created_by;

  -- Edge Function の呼び出しは Webhook 経由で行う
  -- この関数は pg_net 拡張を使用して HTTP リクエストを送信できる
  -- 
  -- 注意: pg_net が有効な場合のみ以下を使用:
  -- PERFORM net.http_post(
  --   url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification',
  --   headers := jsonb_build_object(
  --     'Content-Type', 'application/json',
  --     'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
  --   ),
  --   body := jsonb_build_object(
  --     'user_ids', member_ids,
  --     'title', '新しいお知らせ',
  --     'body', NEW.title,
  --     'url', '/announcements',
  --     'tag', 'announcement'
  --   )
  -- );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーの作成
DROP TRIGGER IF EXISTS announcement_notification_trigger ON announcements;
CREATE TRIGGER announcement_notification_trigger
  AFTER INSERT ON announcements
  FOR EACH ROW EXECUTE FUNCTION notify_on_announcement();

-- =============================================================================
-- Event Reminder (pg_cron ジョブ) - 毎日朝9時に実行
-- =============================================================================
-- 注意: pg_cron は Supabase Pro プランで利用可能
-- 
-- SELECT cron.schedule(
--   'event-reminder',
--   '0 9 * * *',  -- 毎日9:00 JST
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-event-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer SERVICE_ROLE_KEY'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
