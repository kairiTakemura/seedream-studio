# Seedream Studio — AI Image Generator

Seedream 4.5 を利用した画像生成 Web アプリケーションです。  
プロンプト入力・参照画像アップロード・アスペクト比選択を組み合わせて、高品質な画像を生成できます。

---

## デモ画面

| 入力画面 | 生成結果 |
|----------|----------|
| プロンプト入力 + 参照画像アップロード + アスペクト比選択 | 生成画像の表示 + ダウンロード |

---

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 画像生成 API | [Replicate](https://replicate.com) (`bytedance/seedream-4.5`) |
| 通知 | Sonner (Toast) |
| アイコン | Lucide React |
| デプロイ | Vercel |

---

## 機能一覧

- **テキストプロンプト入力** — 生成したい画像の説明を入力
- **参照画像アップロード** — 最大 5 枚の画像をドラッグ＆ドロップまたはクリックで追加
- **アスペクト比選択** — 1:1 / 16:9 / 9:16 / 4:3 / 3:4 から選択
- **セキュアな API 呼び出し** — API キーはサーバーサイドのみで使用
- **ローディング UI** — 生成中はアニメーション付きスケルトン表示
- **ワンクリックダウンロード** — 生成画像をローカルに保存
- **フルスクリーン表示** — 生成画像を拡大確認
- **レスポンシブ対応** — スマホ・タブレット・PC すべてに最適化
- **エラーハンドリング** — トースト通知で分かりやすくフィードバック

---

## セットアップ手順

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-username/seedream-studio.git
cd seedream-studio
```

### 2. 依存パッケージをインストール

```bash
npm install
```

### 3. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` を開いて Replicate の API トークンを設定します:

```
REPLICATE_API_TOKEN=r8_ここにあなたのトークンを貼り付け
```

> **API トークンの取得方法:**
> 1. [Replicate](https://replicate.com) にアカウント登録/ログイン
> 2. [API Tokens ページ](https://replicate.com/account/api-tokens) にアクセス
> 3. 「Create token」でトークンを生成しコピー

### 4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## Vercel へのデプロイ手順

### 方法 A: Vercel CLI を使う場合

```bash
# Vercel CLI をインストール（未導入の場合）
npm i -g vercel

# デプロイ
vercel

# 本番デプロイ
vercel --prod
```

### 方法 B: Vercel ダッシュボードから（推奨）

1. コードを GitHub リポジトリにプッシュ

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/seedream-studio.git
   git push -u origin main
   ```

2. [Vercel ダッシュボード](https://vercel.com/dashboard) にアクセス

3. 「Add New → Project」をクリック

4. GitHub リポジトリを選択してインポート

5. **Environment Variables** セクションで以下を追加:

   | Key | Value |
   |-----|-------|
   | `REPLICATE_API_TOKEN` | `r8_xxxxxxxxxxxx` |

6. 「Deploy」をクリック

### 重要: 関数の実行時間について

画像生成には 30 秒〜2 分かかる場合があります。  
Vercel の **Hobby プラン**ではサーバーレス関数のタイムアウトが **10 秒**に制限されているため、  
**Pro プラン**（タイムアウト上限 300 秒）の利用を推奨します。

代替策として、Replicate の Webhook を使った非同期処理に変更することも可能です。

---

## プロジェクト構成

```
seedream-studio/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts          # 画像生成 API ルート
│   ├── components/
│   │   ├── AspectRatioSelector.tsx  # アスペクト比選択 UI
│   │   ├── GeneratedImage.tsx       # 生成結果表示 + ダウンロード
│   │   ├── GeneratingLoader.tsx     # ローディング UI
│   │   └── ImageUploader.tsx        # 参照画像アップロード
│   ├── globals.css                # グローバル CSS
│   ├── layout.tsx                 # ルートレイアウト
│   └── page.tsx                   # メインページ
├── lib/
│   └── utils.ts                   # ユーティリティ関数
├── public/
├── .env.example                   # 環境変数テンプレート
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## カスタマイズ

### 別の Replicate モデルを使う

`app/api/generate/route.ts` 内の以下の行を変更:

```typescript
const output = await replicate.run("bytedance/seedream-4.5", {
  input,
});
```

例えば FLUX や Stable Diffusion を使う場合:

```typescript
const output = await replicate.run("black-forest-labs/flux-1.1-pro", {
  input,
});
```

### 入力パラメータの追加

モデルごとにサポートされるパラメータが異なります。  
`input` オブジェクトにフィールドを追加してください:

```typescript
const input = {
  prompt: prompt.trim(),
  aspect_ratio: "1:1",
  num_inference_steps: 50,   // 推論ステップ数
  guidance_scale: 7.5,        // ガイダンススケール
};
```

---

## ライセンス

MIT
