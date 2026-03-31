"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2, ChevronDown, BookMarked, Layers, Settings2 } from "lucide-react";

import ImageUploader from "./components/ImageUploader";
import AspectRatioSelector from "./components/AspectRatioSelector";
import GeneratedImage from "./components/GeneratedImage";
import GeneratingLoader from "./components/GeneratingLoader";
import SavePresetModal from "./components/SavePresetModal";
import PresetsTab from "./components/PresetsTab";
import BatchTab from "./components/BatchTab";
import { fetchPresets } from "@/lib/presets";
import { type Preset } from "@/lib/supabase";

type ModelValue =
  | "seedream-4.5"
  | "seedream-4.5-pro"
  | "seedream-4.5-turbo"
  | "flux1-dev-nsfw";

type TabValue = "generate" | "batch" | "presets";

const MODEL_GROUPS = [
  {
    group: "Seedream",
    models: [
      { value: "seedream-4.5" as ModelValue, label: "Seedream 4.5", description: "標準モデル（高速）" },
      { value: "seedream-4.5-pro" as ModelValue, label: "Seedream 4.5 Pro", description: "高品質・高精度" },
      { value: "seedream-4.5-turbo" as ModelValue, label: "Seedream 4.5 Turbo", description: "超高速生成" },
    ],
  },
  {
    group: "NSFW",
    models: [
      { value: "flux1-dev-nsfw" as ModelValue, label: "FLUX.1-dev (NSFW)", description: "高品質・無制限" },
    ],
  },
];

const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);

const TABS = [
  { value: "generate" as TabValue, label: "通常生成", icon: Wand2 },
  { value: "batch" as TabValue, label: "一括生成", icon: Layers },
  { value: "presets" as TabValue, label: "プリセット管理", icon: Settings2 },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabValue>("generate");
  const [prompt, setPrompt] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [selectedModel, setSelectedModel] = useState<ModelValue>("seedream-4.5");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsRefreshKey, setPresetsRefreshKey] = useState(0);

  const loadPresets = useCallback(async () => {
    try {
      const data = await fetchPresets(false);
      setPresets(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { loadPresets(); }, [loadPresets, presetsRefreshKey]);

  const poll = useCallback(async (id: string, model: string): Promise<string> => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/generate/${id}?model=${encodeURIComponent(model)}`);
      const data = await res.json();
      if (data.status === "succeeded" && data.imageUrl) return data.imageUrl;
      if (data.status === "failed" || data.status === "canceled") {
        throw new Error(data.error || "画像生成に失敗しました");
      }
    }
    throw new Error("タイムアウト");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { toast.error("プロンプトを入力してください"); return; }
    setIsGenerating(true);
    setResultUrl(null);
    try {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("aspectRatio", aspectRatio);
      formData.append("model", selectedModel);
      for (const file of referenceFiles) formData.append("referenceImages", file);
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "画像生成の開始に失敗しました");
      const imageUrl =
        data.status === "COMPLETED" && data.imageUrl
          ? data.imageUrl
          : await poll(data.id, selectedModel);
      setResultUrl(imageUrl);
      toast.success("画像が生成されました！");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "予期しないエラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, selectedModel, referenceFiles, poll]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-sm shadow-accent/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-surface-800">Seedream Studio</h1>
              <p className="hidden text-[11px] text-surface-400 sm:block">
                Powered by {ALL_MODELS.find(m => m.value === selectedModel)?.label ?? "Seedream 4.5"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-16 z-30 border-b border-surface-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-0">
            {TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === value
                    ? "border-accent text-accent"
                    : "border-transparent text-surface-500 hover:text-surface-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {activeTab === "generate" && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
            <div className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="prompt" className="block text-sm font-semibold text-surface-700">
                  プロンプト <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="prompt"
                  rows={4}
                  placeholder="生成したい画像を説明してください…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="input-base resize-none scrollbar-thin"
                />
              </div>
              <ImageUploader files={referenceFiles} onChange={setReferenceFiles} />
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-surface-700">モデル</label>
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
              <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="btn-primary w-full !py-3.5 text-base"
              >
                {isGenerating ? (
                  <><svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>生成中…</>
                ) : (
                  <><Wand2 className="h-5 w-5" />生成する</>
                )}
              </button>
              {(prompt.trim() || referenceFiles.length > 0) && (
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
            <div className="lg:sticky lg:top-32 lg:self-start">
              {isGenerating && <GeneratingLoader />}
              {resultUrl && !isGenerating && <GeneratedImage url={resultUrl} />}
              {!resultUrl && !isGenerating && (
                <div className="flex aspect-square max-h-[540px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50/50">
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <div className="rounded-2xl bg-surface-100 p-4">
                      <Sparkles className="h-8 w-8 text-surface-300" />
                    </div>
                    <p className="text-sm font-medium text-surface-500">生成結果がここに表示されます</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "batch" && <BatchTab presets={presets} />}
        {activeTab === "presets" && <PresetsTab refreshKey={presetsRefreshKey} />}
      </main>

      {showSaveModal && (
        <SavePresetModal
          prompt={prompt}
          aspectRatio={aspectRatio}
          imageFiles={referenceFiles}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => setPresetsRefreshKey((k) => k + 1)}
        />
      )}

      <footer className="border-t border-surface-200 bg-white/50 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-xs text-surface-400">
            Seedream Studio · Powered by ByteDance Seedream 4.5
          </p>
        </div>
      </footer>
    </div>
  );
}
