# サークル結 (Circle Knot)

大学サークル向けの「出欠・集金・告知」管理 PWA です。マルチテナント対応しており、複数のサークルを安全に分離して管理できます。

## 技術スタック
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Postgres, RLS)
- **Design**: Premium Mobile-First UI (Lucide Icons)
- **PWA**: manifest.json, Service Worker

## セットアップ手順

### 1. Supabase の設定
- `supabase/migrations/` にある SQL を Supabase の SQL Editor で実行します。
- `auth.users` のメタデータに `role` を追加できるよう、Supabase Auth の設定を確認してください。

### 2. 環境変数の設定
`.env.example` を `.env.local` にコピーし、以下の値を設定します。
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase プロジェクトの URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase の Anon Key
- `NEXT_PUBLIC_OWNER_CREATE_CODE`: オーナー登録時に必要な秘密のコード

### 3. ローカル実行
```bash
npm install
npm run dev
```

## 主要機能
1. **マルチテナント分離**: RLS によりサークル間のデータは完全に分離。
2. **イベント管理**: 作成、出欠回答（参加・欠席・検討中）。締切後のロック機能付き。
3. **集金管理**: 「参加」回答者に対し自動的に支払いレコードを生成。オーナーによる一括消込。
4. **告知機能**: サークル全体へのお知らせ投稿。
5. **PWA 対応**: ホーム画面に追加してアプリとして利用可能。

## 初期運用手順
1. **オーナー作成**: `login` 画面で `OWNER_CREATE_CODE` を入力してサインアップ。
2. **サークル作成**: `onboarding` 画面でサークルを作成。
3. **メンバー招待**: `admin` 画面の招待コードをメンバーに共有。
4. **メンバー参加**: メンバーが登録時に招待コードを入力。
5. **運用開始**: イベント作成 -> 出欠確認 -> 集金消込。
