"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2, BookMarked, Layers, Settings2, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

import ImageUploader from "./components/ImageUploader";
import AspectRatioSelector from "./components/AspectRatioSelector";
import GeneratedImage from "./components/GeneratedImage";
import GeneratingLoader from "./components/GeneratingLoader";
import SavePresetModal from "./components/SavePresetModal";
import PresetsTab from "./components/PresetsTab";
import BatchTab from "./components/BatchTab";
import { fetchPresets } from "@/lib/presets";
import { type Preset } from "@/lib/supabase";

type TabValue = "generate" | "batch" | "presets";

const TABS = [
  { value: "generate" as TabValue, label: "通常生成", icon: Wand2 },
  { value: "batch" as TabValue, label: "一括生成", icon: Layers },
  { value: "presets" as TabValue, label: "プリセット管理", icon: Settings2 },
];

const MODEL = "seedream-4.5";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabValue>("generate");
  const [prompt, setPrompt] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsRefreshKey, setPresetsRefreshKey] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  
  const supabase = createSupabaseBrowserClient();

  // ユーザーとクレジット数を取得
  const fetchUserData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", currentUser.id)
        .single();
      if (profile) setCredits(profile.credits);
    } else {
      setCredits(null);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUserData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUserData();
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("ログアウトしました");
  };

  const loadPresets = useCallback(async () => {
    try {
      const data = await fetchPresets(false);
      setPresets(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadPresets(); }, [loadPresets, presetsRefreshKey]);

  // プリセットを通常生成にロード
  const handleLoadPreset = useCallback(async (preset: Preset) => {
    setPrompt(preset.prompt);
    setAspectRatio(preset.aspect_ratio);
    setResultUrl(null);

    // 参照画像をURLからFileに変換してセット
    if (preset.images && preset.images.length > 0) {
      try {
        const files = await Promise.all(
          preset.images.map(async (img) => {
            const res = await fetch(img.url!);
            const blob = await res.blob();
            const ext = blob.type.includes("png") ? "png" : "jpg";
            return new File([blob], `preset-img.${ext}`, { type: blob.type });
          })
        );
        setReferenceFiles(files);
      } catch {
        setReferenceFiles([]);
      }
    } else {
      setReferenceFiles([]);
    }

    setActiveTab("generate");
  }, []);

  // 画像を最大1024pxにリサイズ＆JPEG圧縮（Vercel 4.5MB制限対策）
  const compressImage = useCallback(async (file: File): Promise<File> => {
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
  }, []);

  const poll = useCallback(async (id: string): Promise<string> => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/generate/${id}?model=${MODEL}`);
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
    if (!user) { toast.error("画像生成にはログインが必要です"); return; }
    
    setIsGenerating(true);
    setResultUrl(null);
    try {
      // 参照画像を圧縮してからFormDataに追加（Vercel 4.5MB制限対策）
      const compressedFiles = referenceFiles.length > 0
        ? await Promise.all(referenceFiles.map(compressImage))
        : [];

      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("aspectRatio", aspectRatio);
      formData.append("model", MODEL);
      for (const file of compressedFiles) formData.append("referenceImages", file);

      const res = await fetch("/api/generate", { method: "POST", body: formData });

      // 非JSONレスポンス（413 Request Entity Too Large等）を適切にハンドリング
      const text = await res.text();
      let data: { error?: string; status?: string; imageUrl?: string; id?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`サーバーエラー: ${text.slice(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || "画像生成の開始に失敗しました");
      const imageUrl =
        data.status === "COMPLETED" && data.imageUrl
          ? data.imageUrl
          : await poll(data.id!);
      setResultUrl(imageUrl);
      toast.success("画像が生成されました！");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "予期しないエラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, referenceFiles, poll, user, compressImage]);

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
              <p className="hidden text-[11px] text-surface-400 sm:block">Powered by ByteDance Seedream 4.5</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-blue-50/50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
                  <span className="text-xs font-bold">残 {credits ?? 0} クレジット</span>
                  <Link href="/pricing" className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-full transition">
                    追加
                  </Link>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 rounded-full border border-surface-200">
                  <UserIcon className="w-3.5 h-3.5 text-surface-500" />
                  <span className="text-xs font-medium text-surface-600 truncate max-w-[150px]">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-surface-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="ログアウト"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link href="/login" className="btn-primary flex items-center gap-2 !py-2 !px-4 text-sm">
                ログイン / 登録
              </Link>
            )}
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

        {activeTab === "presets" && (
          <PresetsTab
            refreshKey={presetsRefreshKey}
            onLoadPreset={handleLoadPreset}
          />
        )}
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
        <div className="mx-auto flex flex-col items-center max-w-6xl px-4 sm:px-6">
          <p className="text-center text-xs text-surface-400 mb-2">
            Seedream Studio · Powered by ByteDance Seedream 4.5
          </p>
          <Link href="/tokushoho" className="text-xs text-surface-400 hover:text-surface-600 underline">
            特定商取引法に基づく表記
          </Link>
        </div>
      </footer>
    </div>
  );
}
