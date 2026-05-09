# Seedream Studio Project Context

## プロジェクト概要
BytePlus ModelArk (Seedream 4.5) および RunPod (FLUX.1-dev) をバックエンドとした画像生成Webアプリケーションです。
参照画像＋プロンプトのセットを「プリセット」として保存・共有し、ベース画像に対して複数プリセットを一括適用できる機能を持ちます。
現在、ユーザー認証（Supabase Auth）および課金システム（Stripe）の実装・統合を進めている段階です。

## 技術スタック
- **フレームワーク**: Next.js 14.2.15 (App Router)
- **言語**: TypeScript 5.6
- **スタイリング**: Tailwind CSS 3.4
- **データベース & ストレージ**: Supabase (PostgreSQL, Storage)
- **デプロイ**: Vercel (Hobbyプラン)
- **決済**: Stripe
- **画像生成API**:
  - **通常生成**: BytePlus ModelArk (Seedream 4.5) - 同期通信
  - **NSFW生成**: RunPod Serverless (FLUX.1-dev ComfyUI) - 非同期通信（ポーリング）

## 主要なパッケージ (package.json)
- `next`, `react`, `react-dom`
- `@supabase/supabase-js`, `@supabase/ssr`
- `stripe`, `@stripe/stripe-js`
- `lucide-react`, `sonner` (UI・アイコン)
- `tailwindcss`, `clsx`, `tailwind-merge`

## ディレクトリ構成
```text
seedream-studio/
├── app/
│   ├── page.tsx                        # メインUI（通常/一括/プリセットの3タブ構成）
│   ├── layout.tsx
│   ├── globals.css
│   ├── api/
│   │   └── generate/
│   │       ├── route.ts                # 画像生成API (POST: 同期/非同期の振り分け)
│   │       └── [id]/route.ts           # RunPod用ポーリングAPI (GET)
│   └── components/
│       ├── AspectRatioSelector.tsx     # アスペクト比選択
│       ├── BatchTab.tsx                # 一括生成タブ
│       ├── GeneratedImage.tsx          # 生成結果表示・保存
│       ├── GeneratingLoader.tsx        # 生成中ローダー
│       ├── ImageUploader.tsx           # 参照画像アップロード
│       ├── PresetsTab.tsx              # プリセット管理タブ
│       └── SavePresetModal.tsx         # プリセット保存モーダル
├── lib/
│   ├── supabase.ts                     # Supabaseクライアント・型定義
│   ├── presets.ts                      # プリセットCRUD関数
│   └── utils.ts
└── middleware.ts                       # ルーティング・認証ミドルウェア
```

## データベース設計 (Supabase)
### テーブル: `presets`
- `id` (uuid, PK)
- `name` (text): プリセット名
- `prompt` (text): 生成プロンプト
- `aspect_ratio` (text): アスペクト比
- `is_public` (boolean): 公開フラグ
- `use_count` (integer): 使用回数
- `created_at`, `updated_at` (timestamptz)

### テーブル: `preset_images`
- `id` (uuid, PK)
- `preset_id` (uuid, FK → presets.id, CASCADE)
- `storage_path` (text): Supabase Storageのパス (preset-images バケット)
- `order_index` (integer): 表示順

※**現在のRLS（Row Level Security）状態**: 認証なしで全操作が許可（`true`）されています。

## 環境変数 (.env.local)
```env
# BytePlus ModelArk (Seedream 4.5)
BYTEPLUS_API_KEY=
BYTEPLUS_ENDPOINT_ID=

# RunPod (FLUX.1-dev NSFW)
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID_FLUX_NSFW=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Stripe (実装中)
# STRIPE_SECRET_KEY=...
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

## API連携フロー
1. **Seedream 4.5 (BytePlus)**:
   - クライアントから `POST /api/generate` をコール
   - APIルートからBytePlus APIを叩き、**同期**でレスポンスを待つ
   - `{ status: "COMPLETED", imageUrl: "https://..." }` をクライアントへ返却
   - **注意**: 生成されたURLは24時間で失効するため、必要に応じてSupabase Storageに保存処理を行う。
   
2. **FLUX.1-dev NSFW (RunPod)**:
   - クライアントから `POST /api/generate` をコール
   - APIルートからRunPodの `/run` エンドポイントを叩き、`job_id` を取得して即時返却（**非同期**）
   - クライアントは `GET /api/generate/[job_id]` を2秒間隔でポーリング
   - ステータスが `COMPLETED` になったら画像データ(Base64等)を取得。

## 開発上の注意点・制約事項
1. **Vercel Hobbyプランの制約**: サーバーレス関数の実行時間上限（maxDuration）が60秒です。BytePlusの同期生成が60秒を超えるとタイムアウトするリスクがあります。
2. **BytePlusのフィルター仕様**: 入力画像のContent pre-filterを無効化するために Customized endpoint を使用しています。エンドポイントIDが変わった場合は `BYTEPLUS_ENDPOINT_ID` の更新が必要です。
3. **RLSの強化**: 現在はパブリック状態のため、ユーザー認証を実装した後にRLSポリシーをユーザーIDベースに厳格化する必要があります。
4. **一括生成の並列化**: 現在はAPI制限を考慮して順次実行となっています。
