"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2, ChevronDown } from "lucide-react";

import ImageUploader from "./components/ImageUploader";
import AspectRatioSelector from "./components/AspectRatioSelector";
import GeneratedImage from "./components/GeneratedImage";
import GeneratingLoader from "./components/GeneratingLoader";

const MODEL_GROUPS = [
  {
    group: "Seedream",
    models: [
      { value: "seedream-4.5",       label: "Seedream 4.5",        description: "標準モデル（高速）" },
      { value: "seedream-4.5-pro",   label: "Seedream 4.5 Pro",    description: "高品質・高精度" },
      { value: "seedream-4.5-turbo", label: "Seedream 4.5 Turbo",  description: "超高速生成" },
    ],
  },
  {
    group: "NSFW",
    models: [
      { value: "flux1-dev-nsfw", label: "FLUX.1-dev (NSFW)", description: "高品質・無制限" },
    ],
  },
] as const;

type ModelValue = typeof MODEL_GROUPS[number]["models"][number]["value"];

const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [selectedModel, setSelectedModel] = useState<ModelValue>("seedream-4.5");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const poll = useCallback(async (id: string): Promise<string> => {
    const maxAttempts = 120; // ~4 minutes with 2s interval
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/generate/${id}?model=${encodeURIComponent(selectedModel)}`);
      const data = await res.json();

      if (data.status === "succeeded" && data.imageUrl) {
        return data.imageUrl;
      }
      if (data.status === "failed" || data.status === "canceled") {
        const debugInfo = data.debug ? `\n[Debug] ${JSON.stringify(data.debug)}` : "";
        throw new Error((data.error || "画像生成に失敗しました") + debugInfo);
      }
      // "starting" or "processing" → keep polling
    }
    throw new Error("タイムアウト: 画像生成に時間がかかりすぎています");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("プロンプトを入力してください");
      return;
    }

    setIsGenerating(true);
    setResultUrl(null);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("aspectRatio", aspectRatio);
      formData.append("model", selectedModel);

      for (const file of referenceFiles) {
        formData.append("referenceImages", file);
      }

      // Step 1: Kick off prediction
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "画像生成の開始に失敗しました");
      }

      // Step 2: Poll until complete
      const imageUrl = await poll(data.id);
      setResultUrl(imageUrl);
      toast.success("画像が生成されました！");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "予期しないエラーが発生しました";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, selectedModel, referenceFiles, poll]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-sm shadow-accent/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-surface-800">
                Seedream Studio
              </h1>
              <p className="hidden text-[11px] text-surface-400 sm:block">
                Powered by {ALL_MODELS.find(m => m.value === selectedModel)?.label ?? "Seedream 4.5"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-surface-400">
            <span className="hidden sm:inline rounded-lg bg-surface-100 px-2.5 py-1 font-mono text-[11px] text-surface-500">
              v1.0
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
          {/* Left Column — Controls */}
          <div className="space-y-6">
            {/* Prompt Input */}
            <div className="space-y-3">
              <label
                htmlFor="prompt"
                className="block text-sm font-semibold text-surface-700"
              >
                プロンプト
                <span className="ml-1 text-red-500">*</span>
              </label>
              <textarea
                id="prompt"
                rows={4}
                placeholder="生成したい画像を説明してください…&#10;&#10;例: A premium product photo of a minimal glass perfume bottle on a marble surface, soft studio lighting, clean white background"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="input-base resize-none scrollbar-thin"
              />
              <p className="text-xs text-surface-400">
                英語で入力するとより高品質な結果が得られます
              </p>
            </div>

            {/* Reference Images */}
            <ImageUploader files={referenceFiles} onChange={setReferenceFiles} />

            {/* Model Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-surface-700">
                モデル
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelValue)}
                  className="input-base w-full appearance-none pr-10 cursor-pointer"
                >
                  {MODEL_GROUPS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.models.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label} — {model.description}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              </div>
            </div>

            {/* Aspect Ratio */}
            <AspectRatioSelector
              value={aspectRatio}
              onChange={setAspectRatio}
            />

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="btn-primary w-full !py-3.5 text-base"
            >
              {isGenerating ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  生成中…
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  生成する
                </>
              )}
            </button>
          </div>

          {/* Right Column — Result */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {isGenerating && <GeneratingLoader />}

            {resultUrl && !isGenerating && <GeneratedImage url={resultUrl} />}

            {/* Empty state */}
            {!resultUrl && !isGenerating && (
              <div className="flex aspect-square max-h-[540px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50/50">
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <div className="rounded-2xl bg-surface-100 p-4">
                    <Sparkles className="h-8 w-8 text-surface-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-500">
                      生成結果がここに表示されます
                    </p>
                    <p className="mt-1 text-xs text-surface-400">
                      プロンプトを入力して「生成する」をクリック
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white/50 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-xs text-surface-400">
            Seedream Studio · Built with Next.js &amp; Replicate · {ALL_MODELS.find(m => m.value === selectedModel)?.label ?? "Seedream 4.5"}{" "}
            by ByteDance
          </p>
        </div>
      </footer>
    </div>
  );
}
