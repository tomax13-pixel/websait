# Web Push 通知セットアップガイド

## 1. VAPID キーの生成

ターミナルで以下を実行：

```bash
npx web-push generate-vapid-keys
```

出力例：
```
Public Key: BNxXV...
Private Key: abc123...
```

---

## 2. 環境変数の設定

### ローカル (.env.local)
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxXV...（Public Key）
```

### Supabase Dashboard → Edge Functions → Secrets
```
VAPID_PUBLIC_KEY=BNxXV...
VAPID_PRIVATE_KEY=abc123...
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 3. SQL マイグレーション実行

Supabase SQL Editor で実行：

1. `supabase/migrations/20240211000000_push_subscriptions.sql`
2. `supabase/migrations/20240211000001_notification_triggers.sql`（オプション）

---

## 4. Edge Function デプロイ（Pro プラン）

```bash
supabase functions deploy send-push-notification
```

---

## 5. 動作確認

1. ホーム画面で「通知を許可する」バナーが表示される
2. 許可後、`push_subscriptions` テーブルにレコードが追加される
3. お知らせ投稿時に通知が届く（Edge Function 設定後）

---

## 注意事項

- Edge Functions と pg_cron は **Supabase Pro プラン**が必要
- 通知は HTTPS 環境でのみ動作
- iOS Safari は Web Push に制限あり（iOS 16.4+、PWA としてインストール必要）
