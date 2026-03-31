# Seedream Studio — プロジェクト概要

## 概要
Next.js製の画像生成Webアプリ。
- **Seedream 4.5系**: BytePlus ModelArk 公式API
- **FLUX.1-dev NSFW**: RunPod Serverless API（ComfyUI worker）

---

## 技術スタック
- **フロントエンド**: Next.js (App Router) + TypeScript + Tailwind CSS
- **デプロイ**: Vercel（GitHubと連携、pushで自動デプロイ）
- **Seedream 4.5バックエンド**: BytePlus ModelArk API（同期レスポンス）
- **FLUX.1-dev NSFWバックエンド**: RunPod Serverless API（非同期ポーリング）

---

## リポジトリ構成
```
seedream-studio/
├── app/
│   ├── page.tsx                    # メインUI（モデル選択、プロンプト入力など）
│   ├── api/
│   │   └── generate/
│   │       ├── route.ts            # 画像生成API（POST）
│   │       └── [id]/route.ts       # ポーリングAPI（GET）※RunPod用
│   └── components/
│       ├── AspectRatioSelector.tsx
│       ├── GeneratedImage.tsx
│       ├── GeneratingLoader.tsx
│       └── ImageUploader.tsx
├── lib/
│   └── utils.ts
└── .env.local（Vercelの環境変数で管理、GitHubには入れない）
```

---

## モデル構成

### プルダウン表示
```
── Seedream ──────────────────
   Seedream 4.5        （標準モデル・高速）
   Seedream 4.5 Pro    （高品質・高精度）
   Seedream 4.5 Turbo  （超高速生成）
── NSFW ──────────────────────
   FLUX.1-dev (NSFW)   （高品質・無制限）
```

### バックエンドの違い
| モデル | バックエンド | レスポンス方式 | モデルID |
|--------|------------|--------------|---------|
| Seedream 4.5 | BytePlus ModelArk | **同期**（即座にURL返却） | `doubao-seedream-4-5-251128` |
| Seedream 4.5 Pro | BytePlus ModelArk | 同期 | `doubao-seedream-4-5-251128` |
| Seedream 4.5 Turbo | BytePlus ModelArk | 同期 | `doubao-seedream-4-5-251128` |
| FLUX.1-dev NSFW | RunPod | 非同期（ポーリング） | ComfyUI workflow |

---

## 環境変数（Vercelに設定）
```
BYTEPLUS_API_KEY=xxx               # ★新規追加 BytePlus ModelArk APIキー
RUNPOD_API_KEY=xxx                 # 既存 RunPod APIキー（FLUX NSFW用）
RUNPOD_ENDPOINT_ID_FLUX_NSFW=r1c5eu6hr6plxb  # 既存 FLUX NSFWエンドポイント
```

### 不要になった環境変数（削除しても問題なし）
```
RUNPOD_ENDPOINT_ID         # Seedream 4.5用（BytePlusに移行したため不要）
RUNPOD_ENDPOINT_ID_PRO     # Seedream 4.5 Pro用（同上）
RUNPOD_ENDPOINT_ID_TURBO   # Seedream 4.5 Turbo用（同上）
```

---

## BytePlus APIキーの取得手順
1. https://console.byteplus.com にアクセス
2. サインアップ（Gmailなど国際メール必須、初回200枚無料）
3. AI Services → ModelArk → API Keys → Create Key
4. 取得したキーを Vercel の環境変数 `BYTEPLUS_API_KEY` に設定

---

## デプロイ手順
1. このコードをGitHubにpush
2. Vercelの環境変数に `BYTEPLUS_API_KEY` を追加
3. Vercelでリデプロイ → 完了！

---

## APIフロー

### Seedream 4.5（BytePlus）
```
POST /api/generate
  → BytePlus API（同期）
  → { status: "COMPLETED", imageUrl: "https://..." }
  → そのまま表示（ポーリング不要）
```

### FLUX.1-dev NSFW（RunPod）
```
POST /api/generate
  → RunPod /run（非同期）
  → { id: "job_xxx", status: "IN_QUEUE" }
  → GET /api/generate/[id] を2秒ごとにポーリング
  → COMPLETED になったら imageUrl を取得して表示
```
