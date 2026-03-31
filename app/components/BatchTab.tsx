"use client";

import { useState, useCallback } from "react";
import { Upload, X, Wand2, ImageIcon, Download } from "lucide-react";
import { downloadImage } from "./GeneratedImage";
import { type Preset } from "@/lib/supabase";
import { toast } from "sonner";

interface BatchResult {
  presetId: string;
  presetName: string;
  status: "pending" | "generating" | "done" | "error";
  imageUrl?: string;
  error?: string;
}

interface BatchTabProps {
  presets: Preset[];
}

export default function BatchTab({ presets }: BatchTabProps) {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [basePreview, setBasePreview] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<BatchResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleBaseFile = (file: File) => {
    setBaseFile(file);
    setBasePreview(URL.createObjectURL(file));
  };

  const togglePreset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const generateOne = useCallback(async (preset: Preset, base: File): Promise<string> => {
    const formData = new FormData();
    formData.append("prompt", preset.prompt);
    formData.append("aspectRatio", preset.aspect_ratio);
    formData.append("model", "seedream-4.5");
    formData.append("referenceImages", base);

    // プリセットの参照画像もURLから取得して追加
    for (const img of preset.images || []) {
      if (img.url) {
        const resp = await fetch(img.url);
        const blob = await resp.blob();
        const file = new File([blob], "preset-img.jpg", { type: blob.type });
        formData.append("referenceImages", file);
      }
    }

    const res = await fetch("/api/generate", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "生成失敗");
    if (data.status === "COMPLETED" && data.imageUrl) return data.imageUrl;
    throw new Error("画像URLが取得できませんでした");
  }, []);

  const handleBatchGenerate = async () => {
    if (!baseFile) { toast.error("ベース画像をアップロードしてください"); return; }
    if (selectedIds.size === 0) { toast.error("プリセットを1つ以上選択してください"); return; }

    const selected = presets.filter((p) => selectedIds.has(p.id));
    setResults(selected.map((p) => ({ presetId: p.id, presetName: p.name, status: "pending" })));
    setIsRunning(true);

    for (const preset of selected) {
      setResults((prev) => prev.map((r) => r.presetId === preset.id ? { ...r, status: "generating" } : r));
      try {
        const url = await generateOne(preset, baseFile);
        setResults((prev) => prev.map((r) => r.presetId === preset.id ? { ...r, status: "done", imageUrl: url } : r));
      } catch (err) {
        setResults((prev) => prev.map((r) =>
          r.presetId === preset.id ? { ...r, status: "error", error: err instanceof Error ? err.message : "エラー" } : r
        ));
      }
    }
    setIsRunning(false);
    toast.success("一括生成が完了しました！");
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        ベース画像（顔・人物など）を1枚アップロードし、適用したいプリセットを選んで一括生成します。
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左: 設定 */}
        <div className="space-y-5">
          {/* ベース画像 */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-surface-700">ベース画像</label>
            {basePreview ? (
              <div className="relative w-full overflow-hidden rounded-xl border border-surface-200">
                <img src={basePreview} alt="base" className="h-40 w-full object-cover" />
                <button
                  onClick={() => { setBaseFile(null); setBasePreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50 py-8 hover:border-surface-300 hover:bg-surface-100 transition-colors">
                <Upload className="h-6 w-6 text-surface-300" />
                <span className="text-sm text-surface-500">クリックまたはドラッグ＆ドロップ</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleBaseFile(e.target.files[0])} />
              </label>
            )}
          </div>

          {/* プリセット選択 */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-surface-700">
              プリセットを選択
              {selectedIds.size > 0 && (
                <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {selectedIds.size}件選択中
                </span>
              )}
            </label>
            {presets.length === 0 ? (
              <p className="rounded-xl bg-surface-50 px-4 py-6 text-center text-sm text-surface-400">
                プリセットがありません。先に通常生成からプリセットを保存してください。
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {presets.map((preset) => {
                  const checked = selectedIds.has(preset.id);
                  return (
                    <button
                      key={preset.id}
                      onClick={() => togglePreset(preset.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        checked
                          ? "border-accent/40 bg-accent/5"
                          : "border-surface-200 bg-white hover:border-surface-300"
                      }`}
                    >
                      <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        checked ? "border-accent bg-accent" : "border-surface-300"
                      }`}>
                        {checked && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {preset.images?.[0]?.url ? (
                        <img src={preset.images[0].url} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100">
                          <ImageIcon className="h-4 w-4 text-surface-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-surface-800">{preset.name}</p>
                        <p className="truncate text-xs text-surface-400">{preset.prompt}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleBatchGenerate}
            disabled={isRunning || !baseFile || selectedIds.size === 0}
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
                {selectedIds.size > 0 ? `${selectedIds.size}枚まとめて生成` : "生成する"}
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
                onClick={() => {
                  results
                    .filter((r) => r.status === "done" && r.imageUrl)
                    .forEach((r) => downloadImage(r.imageUrl!, `${r.presetName}-${Date.now()}.jpg`));
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
              <p className="text-sm text-surface-400">プリセットを選択して生成してください</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map((result) => (
                <div key={result.presetId} className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
                  <div className="relative aspect-square">
                    {result.status === "done" && result.imageUrl ? (
                      <img src={result.imageUrl} alt={result.presetName} className="h-full w-full object-cover" />
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
                    <p className="truncate text-xs font-medium text-surface-700">{result.presetName}</p>
                    {result.status === "done" && result.imageUrl && (
                      <button
                        onClick={() => downloadImage(result.imageUrl!, `${result.presetName}-${Date.now()}.jpg`)}
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
