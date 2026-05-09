"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, Wand2, Download, FolderOpen, Images } from "lucide-react";
import { downloadImage } from "./GeneratedImage";
import AspectRatioSelector from "./AspectRatioSelector";
import { toast } from "sonner";

interface VariationResult {
  key: string;
  fileName: string;
  status: "pending" | "generating" | "done" | "error";
  imageUrl?: string;
  error?: string;
}

const MODEL = "seedream-4.5";

// ファイル名から拡張子を除いた basename
function basename(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

export default function VariationTab() {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [basePreview, setBasePreview] = useState<string | null>(null);
  const [variationFiles, setVariationFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [results, setResults] = useState<VariationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const handleBaseFile = (file: File) => {
    setBaseFile(file);
    setBasePreview(URL.createObjectURL(file));
  };

  const addVariationFiles = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      toast.error("画像ファイルが見つかりませんでした");
      return;
    }
    setVariationFiles((prev) => [...prev, ...imgs]);
  };

  const removeVariation = (idx: number) => {
    setVariationFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const generateOne = useCallback(
    async (base: File, variation: File): Promise<string> => {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("aspectRatio", aspectRatio);
      formData.append("model", MODEL);
      formData.append("referenceImages", base);
      formData.append("referenceImages", variation);

      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失敗");
      if (data.status === "COMPLETED" && data.imageUrl) return data.imageUrl;
      throw new Error("画像URLが取得できませんでした");
    },
    [prompt, aspectRatio]
  );

  const handleRun = async () => {
    if (!baseFile) { toast.error("ベース画像をアップロードしてください"); return; }
    if (variationFiles.length === 0) { toast.error("バリエーション画像を1枚以上選択してください"); return; }
    if (!prompt.trim()) { toast.error("プロンプトを入力してください"); return; }

    const initial: VariationResult[] = variationFiles.map((f, i) => ({
      key: `${i}-${f.name}`,
      fileName: f.name,
      status: "pending",
    }));
    setResults(initial);
    setIsRunning(true);

    for (let i = 0; i < variationFiles.length; i++) {
      const file = variationFiles[i];
      const key = `${i}-${file.name}`;
      setResults((prev) => prev.map((r) => r.key === key ? { ...r, status: "generating" } : r));
      try {
        const url = await generateOne(baseFile, file);
        setResults((prev) => prev.map((r) => r.key === key ? { ...r, status: "done", imageUrl: url } : r));
      } catch (err) {
        setResults((prev) => prev.map((r) =>
          r.key === key
            ? { ...r, status: "error", error: err instanceof Error ? err.message : "エラー" }
            : r
        ));
      }
    }
    setIsRunning(false);
    toast.success("バリエーション生成が完了しました！");
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        ベース画像（1枚目固定）に対し、バリエーション画像（2枚目）を入れ替えながら同じプロンプトで一括生成します。
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左: 設定 */}
        <div className="space-y-5">
          {/* ベース画像 */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-surface-700">
              ベース画像（固定・1枚目）
            </label>
            {basePreview ? (
              <div className="relative w-full overflow-hidden rounded-xl border border-surface-200">
                <img src={basePreview} alt="base" className="h-48 w-full object-cover" />
                <button
                  onClick={() => { setBaseFile(null); setBasePreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50 py-12 hover:border-surface-300 hover:bg-surface-100 transition-colors">
                <Upload className="h-6 w-6 text-surface-300" />
                <span className="text-sm text-surface-500">クリックまたはドラッグ＆ドロップ</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleBaseFile(e.target.files[0])}
                />
              </label>
            )}
          </div>

          {/* バリエーション画像 */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-surface-700">
              バリエーション画像（2枚目・複数）
              {variationFiles.length > 0 && (
                <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {variationFiles.length}枚
                </span>
              )}
            </label>

            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                className="btn-secondary !py-2 gap-2 flex-1"
              >
                <Images className="h-4 w-4" />
                画像を選択
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="btn-secondary !py-2 gap-2 flex-1"
              >
                <FolderOpen className="h-4 w-4" />
                フォルダを選択
              </button>
              <input
                ref={filesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addVariationFiles(e.target.files); e.target.value = ""; }}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                /* eslint-disable @typescript-eslint/ban-ts-comment */
                // @ts-expect-error - non-standard but supported by Chromium/WebKit
                webkitdirectory=""
                directory=""
                onChange={(e) => { addVariationFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {variationFiles.length > 0 ? (
              <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-surface-200 bg-surface-50 p-2">
                {variationFiles.map((f, i) => (
                  <div key={`${i}-${f.name}`} className="relative aspect-square overflow-hidden rounded-lg border border-surface-200 bg-white">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeVariation(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[9px] text-white" title={f.name}>
                      {f.name}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-surface-50 px-4 py-6 text-center text-sm text-surface-400">
                画像またはフォルダを選択してください
              </p>
            )}
          </div>

          {/* プロンプト */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-surface-700">
              プロンプト <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="生成したい画像を説明してください…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="input-base resize-none scrollbar-thin"
            />
          </div>

          <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />

          <button
            onClick={handleRun}
            disabled={isRunning || !baseFile || variationFiles.length === 0 || !prompt.trim()}
            className="btn-primary w-full !py-3 gap-2"
          >
            {isRunning ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                {variationFiles.length > 0 ? `${variationFiles.length}枚を順次生成` : "生成する"}
              </>
            )}
          </button>
        </div>

        {/* 右: 結果グリッド */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-surface-700">生成結果</label>
            {results.some((r) => r.status === "done") && (
              <button
                onClick={async () => {
                  const done = results.filter((r) => r.status === "done" && r.imageUrl);
                  for (const r of done) {
                    await downloadImage(r.imageUrl!, `${basename(r.fileName)}-生成.jpg`);
                    await new Promise((res) => setTimeout(res, 300));
                  }
                }}
                className="btn-secondary !px-3 !py-1.5 !text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                すべて保存
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50">
              <p className="text-sm text-surface-400">バリエーション画像を選択して生成してください</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map((result) => (
                <div key={result.key} className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
                  <div className="relative aspect-square">
                    {result.status === "done" && result.imageUrl ? (
                      <img src={result.imageUrl} alt={result.fileName} className="h-full w-full object-cover" />
                    ) : result.status === "generating" ? (
                      <div className="flex h-full items-center justify-center">
                        <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : result.status === "error" ? (
                      <div className="flex h-full items-center justify-center p-2">
                        <p className="text-center text-xs text-red-400">{result.error}</p>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-xs text-surface-400">待機中</p>
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs font-medium text-surface-700" title={result.fileName}>
                      {result.fileName}
                    </p>
                    {result.status === "done" && result.imageUrl && (
                      <button
                        onClick={() => downloadImage(result.imageUrl!, `${basename(result.fileName)}-生成.jpg`)}
                        className="flex items-center gap-1 text-[10px] text-accent hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        保存
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
