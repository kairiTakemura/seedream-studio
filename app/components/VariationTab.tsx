"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, Wand2, Download, FolderOpen, Images, BookMarked, Shuffle, ListOrdered } from "lucide-react";
import { downloadImage } from "./GeneratedImage";
import AspectRatioSelector from "./AspectRatioSelector";
import SavePresetModal from "./SavePresetModal";
import { fileToBytePlusSize } from "@/lib/aspectRatio";
import { type Preset } from "@/lib/supabase";
import { toast } from "sonner";

interface VariationResult {
  key: string;
  fileName: string;
  status: "pending" | "generating" | "done" | "error";
  imageUrl?: string;
  error?: string;
}

const MODEL = "seedream-4.5";
const MAX_REF_IMAGES = 10; // BytePlus上限

function basename(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const MAX = 1024;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg", 0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// シャッフル (Fisher–Yates)
function pickRandom<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

interface VariationTabProps {
  initialPreset?: Preset | null;
  onPresetConsumed?: () => void;
  onPresetSaved?: () => void;
}

type Mode = "sequential" | "random";

export default function VariationTab({ initialPreset, onPresetConsumed, onPresetSaved }: VariationTabProps = {}) {
  const [baseFiles, setBaseFiles] = useState<File[]>([]);
  const [variationFiles, setVariationFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [matchInputAspect, setMatchInputAspect] = useState(false);
  const [aspectSource, setAspectSource] = useState<"base" | "variation">("variation");
  const [mode, setMode] = useState<Mode>("sequential");
  const [randomPick, setRandomPick] = useState(2);
  const [randomIterations, setRandomIterations] = useState(5);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [results, setResults] = useState<VariationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const baseFilesInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingBase, setIsDraggingBase] = useState(false);
  const [isDraggingVariation, setIsDraggingVariation] = useState(false);

  const addBaseFiles = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setBaseFiles((prev) => [...prev, ...imgs]);
  };
  const removeBase = (idx: number) => setBaseFiles((prev) => prev.filter((_, i) => i !== idx));

  const addVariationFiles = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      toast.error("画像ファイルが見つかりませんでした");
      return;
    }
    setVariationFiles((prev) => [...prev, ...imgs]);
  };
  const removeVariation = (idx: number) => setVariationFiles((prev) => prev.filter((_, i) => i !== idx));

  // プリセットからのロード: 先頭 base_count 枚=ベース、残り=バリエーション
  useEffect(() => {
    if (!initialPreset) return;
    const preset = initialPreset;
    (async () => {
      try {
        setPrompt(preset.prompt);
        setAspectRatio(preset.aspect_ratio);
        const imgs = preset.images || [];
        const baseCount = Math.max(1, Math.min(preset.base_count ?? 1, imgs.length));
        if (imgs.length === 0) {
          setBaseFiles([]);
          setVariationFiles([]);
          return;
        }
        const fetched = await Promise.all(
          imgs.map(async (img, idx) => {
            const res = await fetch(img.url!);
            const blob = await res.blob();
            const ext = blob.type.includes("png") ? "png" : "jpg";
            const role = idx < baseCount ? "base" : "variation";
            const name = `${role}-${idx}.${ext}`;
            return new File([blob], name, { type: blob.type });
          })
        );
        setBaseFiles(fetched.slice(0, baseCount));
        setVariationFiles(fetched.slice(baseCount));
        toast.success(`「${preset.name}」をロードしました`);
      } catch {
        toast.error("プリセットのロードに失敗しました");
      } finally {
        onPresetConsumed?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPreset]);

  // 任意枚数のベース + バリエーションで1回生成
  const generateOne = useCallback(
    async (bases: File[], variations: File[], aspectRefFile: File | null): Promise<string> => {
      const all = [...bases, ...variations];
      const compressed = await Promise.all(all.map(compressImage));
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("aspectRatio", aspectRatio);
      formData.append("model", MODEL);
      for (const f of compressed) formData.append("referenceImages", f);

      if (matchInputAspect && aspectRefFile) {
        try {
          const customSize = await fileToBytePlusSize(aspectRefFile);
          formData.append("customSize", customSize);
        } catch { /* fallback to aspectRatio */ }
      }

      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const text = await res.text();
      let data: { error?: string; status?: string; imageUrl?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`サーバーエラー: ${text.slice(0, 100)}`);
      }
      if (!res.ok) throw new Error(data.error || "生成失敗");
      if (data.status === "COMPLETED" && data.imageUrl) return data.imageUrl;
      throw new Error("画像URLが取得できませんでした");
    },
    [prompt, aspectRatio, matchInputAspect]
  );

  const handleRun = async () => {
    if (baseFiles.length === 0) { toast.error("ベース画像を1枚以上アップロードしてください"); return; }
    if (variationFiles.length === 0) { toast.error("バリエーション画像を1枚以上選択してください"); return; }
    if (!prompt.trim()) { toast.error("プロンプトを入力してください"); return; }

    if (mode === "sequential") {
      const totalPerCall = baseFiles.length + 1;
      if (totalPerCall > MAX_REF_IMAGES) {
        toast.error(`参照画像は合計${MAX_REF_IMAGES}枚以下にしてください（ベース${baseFiles.length}+バリエ1）`);
        return;
      }
      const initial: VariationResult[] = variationFiles.map((f, i) => ({
        key: `seq-${i}-${f.name}`,
        fileName: f.name,
        status: "pending",
      }));
      setResults(initial);
      setIsRunning(true);
      for (let i = 0; i < variationFiles.length; i++) {
        const file = variationFiles[i];
        const key = `seq-${i}-${file.name}`;
        setResults((prev) => prev.map((r) => r.key === key ? { ...r, status: "generating" } : r));
        try {
          const aspectRef = matchInputAspect
            ? (aspectSource === "base" ? baseFiles[0] : file)
            : null;
          const url = await generateOne(baseFiles, [file], aspectRef);
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
      return;
    }

    // ── ランダムモード ──
    const pick = Math.max(1, Math.min(randomPick, variationFiles.length));
    const iters = Math.max(1, randomIterations);
    const totalPerCall = baseFiles.length + pick;
    if (totalPerCall > MAX_REF_IMAGES) {
      toast.error(`参照画像は合計${MAX_REF_IMAGES}枚以下にしてください（ベース${baseFiles.length}+ランダム${pick}）`);
      return;
    }
    if (pick > variationFiles.length) {
      toast.error("ランダム選択数がバリエーション枚数を超えています");
      return;
    }

    const initial: VariationResult[] = Array.from({ length: iters }, (_, i) => ({
      key: `rand-${i}`,
      fileName: `random-${i + 1}`,
      status: "pending" as const,
    }));
    setResults(initial);
    setIsRunning(true);

    for (let i = 0; i < iters; i++) {
      const key = `rand-${i}`;
      const picks = pickRandom(variationFiles, pick);
      const label = picks.map((f) => basename(f.name)).join("+");
      setResults((prev) => prev.map((r) =>
        r.key === key ? { ...r, status: "generating", fileName: label } : r
      ));
      try {
        const aspectRef = matchInputAspect
          ? (aspectSource === "base" ? baseFiles[0] : picks[0])
          : null;
        const url = await generateOne(baseFiles, picks, aspectRef);
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
    toast.success("ランダム生成が完了しました！");
  };

  const runButtonLabel = mode === "sequential"
    ? (variationFiles.length > 0 ? `${variationFiles.length}枚を順次生成` : "生成する")
    : `ランダムで${randomIterations}回生成（1回${Math.min(randomPick, variationFiles.length || randomPick)}枚）`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        ベース画像（複数可）に対してバリエーション画像を組み合わせて、同じプロンプトで一括生成します。
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左: 設定 */}
        <div className="space-y-5">
          {/* ベース画像（複数可） */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-surface-700">
                ベース画像（固定・複数可）
                {baseFiles.length > 0 && (
                  <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {baseFiles.length}枚
                  </span>
                )}
              </label>
              {baseFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBaseFiles([])}
                  className="flex items-center gap-1 text-xs text-surface-500 hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                  すべてクリア
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => baseFilesInputRef.current?.click()}
              className="btn-secondary w-full !py-2 gap-2 mb-2"
            >
              <Upload className="h-4 w-4" />
              ベース画像を追加
            </button>
            <input
              ref={baseFilesInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addBaseFiles(e.target.files); e.target.value = ""; }}
            />

            {baseFiles.length > 0 ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBase(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingBase(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingBase(false);
                  addBaseFiles(e.dataTransfer.files);
                }}
                className={`grid grid-cols-4 gap-2 rounded-xl border-2 border-dashed bg-surface-50 p-2 transition-colors ${
                  isDraggingBase ? "border-accent bg-accent/5" : "border-surface-200"
                }`}
              >
                {baseFiles.map((f, i) => (
                  <div key={`${i}-${f.name}`} className="relative aspect-square overflow-hidden rounded-lg border border-surface-200 bg-white">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeBase(i)}
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
              <div
                onClick={() => baseFilesInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBase(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingBase(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingBase(false);
                  addBaseFiles(e.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-colors ${
                  isDraggingBase
                    ? "border-accent bg-accent/5"
                    : "border-surface-200 bg-surface-50 hover:border-surface-300 hover:bg-surface-100"
                }`}
              >
                <Upload className={`h-6 w-6 ${isDraggingBase ? "text-accent" : "text-surface-300"}`} />
                <span className="text-sm text-surface-500">クリックまたはドラッグ＆ドロップ</span>
              </div>
            )}
          </div>

          {/* バリエーション画像 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-surface-700">
                バリエーション画像（複数）
                {variationFiles.length > 0 && (
                  <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {variationFiles.length}枚
                  </span>
                )}
              </label>
              {variationFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setVariationFiles([])}
                  className="flex items-center gap-1 text-xs text-surface-500 hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                  すべてクリア
                </button>
              )}
            </div>

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
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingVariation(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingVariation(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingVariation(false);
                  addVariationFiles(e.dataTransfer.files);
                }}
                className={`grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-xl border-2 border-dashed bg-surface-50 p-2 transition-colors ${
                  isDraggingVariation ? "border-accent bg-accent/5" : "border-surface-200"
                }`}
              >
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
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingVariation(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingVariation(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingVariation(false);
                  addVariationFiles(e.dataTransfer.files);
                }}
                className={`rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
                  isDraggingVariation
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-surface-200 bg-surface-50 text-surface-400"
                }`}
              >
                画像またはフォルダを選択 / ここにドラッグ＆ドロップ
              </div>
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

          <div className={matchInputAspect ? "opacity-50 pointer-events-none" : ""}>
            <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
          </div>

          {/* 入力画像のアスペクト比に合わせる */}
          <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={matchInputAspect}
                onChange={(e) => setMatchInputAspect(e.target.checked)}
                className="h-4 w-4 rounded border-surface-300 text-accent focus:ring-accent"
              />
              <span className="text-sm font-medium text-surface-700">
                入力画像のアスペクト比に合わせる
              </span>
            </label>
            {matchInputAspect && (
              <div className="ml-6 flex gap-4 text-xs text-surface-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="variation-aspect-source"
                    checked={aspectSource === "base"}
                    onChange={() => setAspectSource("base")}
                    className="h-3.5 w-3.5 text-accent focus:ring-accent"
                  />
                  ベース画像（1枚目）
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="variation-aspect-source"
                    checked={aspectSource === "variation"}
                    onChange={() => setAspectSource("variation")}
                    className="h-3.5 w-3.5 text-accent focus:ring-accent"
                  />
                  バリエーション画像
                </label>
              </div>
            )}
          </div>

          {/* 生成モード */}
          <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-3 space-y-3">
            <p className="text-sm font-semibold text-surface-700">生成モード</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("sequential")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors border ${
                  mode === "sequential"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface-200 bg-white text-surface-600 hover:border-surface-300"
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                順次（全バリエ × 1枚ずつ）
              </button>
              <button
                type="button"
                onClick={() => setMode("random")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors border ${
                  mode === "random"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface-200 bg-white text-surface-600 hover:border-surface-300"
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                ランダム選択
              </button>
            </div>
            {mode === "random" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-surface-600">
                  1回あたりの選択枚数
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, variationFiles.length || 1)}
                    value={randomPick}
                    onChange={(e) => setRandomPick(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="input-base !py-1.5 mt-1 w-full"
                  />
                </label>
                <label className="text-xs text-surface-600">
                  実行回数
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={randomIterations}
                    onChange={(e) => setRandomIterations(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="input-base !py-1.5 mt-1 w-full"
                  />
                </label>
              </div>
            )}
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning || baseFiles.length === 0 || variationFiles.length === 0 || !prompt.trim()}
            className="btn-primary w-full !py-3 gap-2"
            type="button"
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
                {runButtonLabel}
              </>
            )}
          </button>

          {(prompt.trim() || baseFiles.length > 0 || variationFiles.length > 0) && (
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className="btn-secondary w-full gap-2"
            >
              <BookMarked className="h-4 w-4" />
              プリセットとして保存
            </button>
          )}
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

      {showSaveModal && (
        <SavePresetModal
          prompt={prompt}
          aspectRatio={aspectRatio}
          imageFiles={[...baseFiles, ...variationFiles]}
          baseCount={baseFiles.length}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => onPresetSaved?.()}
        />
      )}
    </div>
  );
}
