# Seedream Studio — 開発引き継ぎドキュメント

## プロジェクト概要

ByteDance Seedream 4.5を使った画像生成Webアプリ。  
参照画像＋プロンプトのセットを「プリセット」として保存・共有し、ベース画像に対して複数プリセットを一括適用できる。

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| デプロイ | Vercel (Hobbyプラン) |
| 画像生成API | BytePlus ModelArk (Seedream 4.5) |
| NSFW生成 | RunPod Serverless (FLUX.1-dev) |
| DB | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| バージョン管理 | GitHub (自動デプロイ) |

---

## リポジトリ構成

```
seedream-studio/
├── app/
│   ├── page.tsx                        # メインUI（3タブ構成）
│   ├── layout.tsx
│   ├── globals.css
│   ├── api/
│   │   └── generate/
│   │       ├── route.ts                # 画像生成API (POST)
│   │       └── [id]/route.ts           # RunPodポーリング (GET)
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
├── HANDOVER.md                         # このファイル
├── PROJECT_README.md                   # 技術的な補足メモ
└── package.json
```

---

## 環境変数

Vercelのプロジェクト設定 → Environment Variables に以下を設定。

```env
# BytePlus ModelArk (Seedream 4.5)
BYTEPLUS_API_KEY=ark-...
BYTEPLUS_ENDPOINT_ID=ep-...          # Customized endpoint ID (Content pre-filter OFF)

# RunPod (FLUX.1-dev NSFW)
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_ID_FLUX_NSFW=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 外部サービスのアカウント情報

### BytePlus ModelArk
- URL: https://console.byteplus.com/modelark
- アカウント: thinglikeabar (Account ID: 3002288456)
- モデル: ByteDance-Seedream-4.5 (Activated)
- エンドポイント名: seedream-45
- エンドポイントID: ep-20260331201535-qxmtc
- Content pre-filter: **OFF**（入力画像フィルターを無効化するために必要）
- 課金: $0.04/枚 (従量制) · 無料枠200枚あり
- 注意: Free Credits Only Mode が有効 → 無料枠終了後は自動停止

### RunPod
- URL: https://www.runpod.io
- エンドポイントID: r1c5eu6hr6plxb (compact_beige_dragonfly)
- モデル: FLUX.1-dev + Flux-Uncensored-V2 LoRA
- Dockerイメージ: thinglikeabar/comfyui-flux-uncensored:v1
- GPU: A40 48GB

### Supabase
- URL: https://supabase.com
- Project ID: jzaymylofdhfuahprkab
- Project URL: https://jzaymylofdhfuahprkab.supabase.co
- Storage bucket: preset-images (Public)

### Vercel
- Project名: seedream-studio
- URL: seedream-studio-seven.vercel.app
- プラン: Hobby (maxDuration上限60秒)
- GitHubと連携済み → pushで自動デプロイ

---

## データベース設計

### テーブル: presets

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid | PK |
| name | text | プリセット名 |
| prompt | text | 生成プロンプト |
| aspect_ratio | text | アスペクト比 (例: "1:1") |
| is_public | boolean | 公開フラグ |
| use_count | integer | 使用回数 |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

### テーブル: preset_images

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid | PK |
| preset_id | uuid | FK → presets.id (CASCADE DELETE) |
| storage_path | text | Supabase Storageのパス |
| order_index | integer | 表示順 |

### ストアドファンクション

```sql
-- 使用回数インクリメント
create or replace function increment_use_count(preset_id uuid)
returns void as $$
  update presets set use_count = use_count + 1 where id = preset_id;
$$ language sql;
```

### RLSポリシー

```sql
-- presets: 全操作許可（認証なし）
create policy "allow all" on presets for all using (true) with check (true);

-- preset_images: 全操作許可（認証なし）
create policy "allow all" on preset_images for all using (true) with check (true);

-- Storage: preset-images バケット全操作許可
create policy "allow all storage" on storage.objects
  for all using (bucket_id = 'preset-images')
  with check (bucket_id = 'preset-images');
```

> 注意: 現在はユーザー認証なしで誰でも読み書き可能。ユーザー認証実装時にRLSを厳格化する必要あり。

---

## 画像生成APIの仕様

### Seedream 4.5 (BytePlus)

**エンドポイント:** `POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`

**リクエスト:**
```json
{
  "model": "ep-20260331201535-qxmtc",
  "prompt": "...",
  "size": "2048x2048",
  "response_format": "url",
  "watermark": false,
  "image": "data:image/jpeg;base64,..."  // 参照画像 (省略可)
}
```

**サイズ対応表:**
| アスペクト比 | size |
|------------|------|
| 1:1 | 2048x2048 |
| 16:9 | 2560x1440 |
| 9:16 | 1440x2560 |
| 4:3 | 2304x1728 |
| 3:4 | 1728x2304 |

**レスポンス:** 同期 → `{ data: [{ url: "https://..." }] }`

**制約:**
- 総ピクセル数: 3,686,400 〜 16,777,216
- 参照画像: 最大10枚 (string | string[])
- Vercel Hobby maxDuration: 60秒

### FLUX.1-dev NSFW (RunPod)

非同期方式 (ComfyUIワークフローJSON)
1. `POST https://api.runpod.ai/v2/{endpointId}/run` → job_id取得
2. `GET https://api.runpod.ai/v2/{endpointId}/status/{job_id}` → 2秒ごとポーリング
3. `COMPLETED` になったら `output.images[0].data` (base64) を取得

---

## 画面構成

### タブ1: 通常生成
- プロンプト入力
- 参照画像アップロード (最大10枚)
- アスペクト比選択
- 生成ボタン
- 結果表示・保存
- プリセットとして保存ボタン

### タブ2: 一括生成
- ベース画像 (顔・人物など) を1枚アップロード
- プリセットをチェックボックスで複数選択
- まとめて生成 → グリッドで結果表示
- 個別保存・全て保存ボタン

### タブ3: プリセット管理
- 自分のプリセット / 公開プリセット の切り替え
- プリセットカード (サムネイル・名前・プロンプト・使用回数)
- 編集ボタン → 通常生成タブにロードして遷移
- 名前・公開設定の変更 (インライン編集)
- 削除ボタン

---

## 今後の実装予定

### 優先度高
- [ ] ユーザー認証 (Supabase Auth)
  - 自分のプリセットのみ編集・削除可能にする
  - RLSをユーザーIDベースに厳格化
  - お気に入り登録機能
- [ ] 一括生成の並列実行 (現在は順次実行)
- [ ] 生成履歴の保存・表示

### 優先度中
- [ ] 課金システム
  - 無料枠 (月N枚) + クレジット購入 + 月額プラン
  - Stripe連携
- [ ] プリセットのタグ・カテゴリ機能
- [ ] 生成結果のダウンロード改善 (ZIPでまとめてDL)

### 優先度低
- [ ] IP-Adapter FaceID (RunPod ComfyUI側の実装が必要)
- [ ] Seedream 4.5 Pro / Turbo 対応 (別エンドポイントID取得が必要)
- [ ] モデル選択の復活 (現在はSeedream 4.5固定)

---

## ローカル開発環境のセットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/kairiTakemura/seedream-studio.git
cd seedream-studio

# 2. 依存関係インストール
npm install

# 3. 環境変数ファイル作成
cp .env.local.example .env.local
# .env.local に各APIキーを設定

# 4. 開発サーバー起動
npm run dev
```

### .env.local に必要な変数

```env
BYTEPLUS_API_KEY=
BYTEPLUS_ENDPOINT_ID=
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID_FLUX_NSFW=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 注意事項・既知の問題

1. **BytePlus Content pre-filter**: Customized endpointを使わないとフィルターが無効化できない。エンドポイントIDが変わった場合は `BYTEPLUS_ENDPOINT_ID` を更新すること。

2. **画像URLの有効期限**: BytePlusの生成画像URLは24時間で失効する。永続保存が必要な場合はSupabase Storageに転送する処理が必要。

3. **Vercel Hobbyプランの制限**: maxDuration=60秒。画像生成が60秒を超えるとタイムアウト。Proプランにアップグレードすれば300秒まで延長可能。

4. **RLSが緩い**: 現在は認証なしで誰でも全プリセットを削除・変更できる。ユーザー認証実装まではパブリックベータとして運用。

5. **一括生成は順次実行**: 現在はプリセットを1枚ずつ順番に生成している。並列化するとBytePassの同時接続制限に引っかかる可能性があるため意図的に順次にしている。
