"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Globe, Lock, ImageIcon } from "lucide-react";
import { fetchPresets, deletePreset, updatePreset } from "@/lib/presets";
import { type Preset } from "@/lib/supabase";
import { toast } from "sonner";

interface PresetsTabProps {
  onSelectForBatch?: (preset: Preset) => void;
  refreshKey?: number;
}

export default function PresetsTab({ onSelectForBatch, refreshKey }: PresetsTabProps) {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPresets(tab === "public");
      setPresets(tab === "public" ? data.filter((p) => p.is_public) : data);
    } catch {
      toast.error("プリセットの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    try {
      await deletePreset(id);
      toast.success("削除しました");
      load();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleEditSave = async (preset: Preset) => {
    try {
      await updatePreset(preset.id, editName, preset.prompt, preset.aspect_ratio, editIsPublic);
      toast.success("更新しました");
      setEditingId(null);
      load();
    } catch {
      toast.error("更新に失敗しました");
    }
  };

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl bg-surface-100 p-1">
          {(["mine", "public"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-white text-surface-800 shadow-sm" : "text-surface-500 hover:text-surface-700"
              }`}
            >
              {t === "mine" ? "自分のプリセット" : "公開プリセット"}
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-surface-400 text-sm">読み込み中...</div>
      ) : presets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 rounded-2xl bg-surface-100 p-4">
            <ImageIcon className="h-8 w-8 text-surface-300" />
          </div>
          <p className="text-sm text-surface-500">
            {tab === "mine" ? "プリセットがありません。通常生成から保存できます。" : "公開プリセットはまだありません。"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset) => (
            <div key={preset.id} className="card rounded-2xl overflow-hidden">
              {/* サムネイル */}
              <div className="relative h-24 bg-surface-100">
                {preset.images?.[0]?.url ? (
                  <img
                    src={preset.images[0].url}
                    alt={preset.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-surface-300" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    preset.is_public
                      ? "bg-green-100 text-green-700"
                      : "bg-surface-200 text-surface-500"
                  }`}>
                    {preset.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {preset.is_public ? "公開" : "非公開"}
                  </span>
                </div>
              </div>

              <div className="p-3">
                {editingId === preset.id ? (
                  <div className="space-y-2">
                    <input
                      className="input-base w-full text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-xs text-surface-600">
                      <input
                        type="checkbox"
                        checked={editIsPublic}
                        onChange={(e) => setEditIsPublic(e.target.checked)}
                        className="rounded"
                      />
                      公開する
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditSave(preset)} className="btn-primary flex-1 !py-1.5 text-xs">保存</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary flex-1 !py-1.5 text-xs">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-sm text-surface-800 truncate">{preset.name}</p>
                    <p className="mt-0.5 text-xs text-surface-400 truncate">{preset.prompt}</p>
                    <p className="mt-0.5 text-[10px] text-surface-300">
                      {preset.aspect_ratio} · 参照{preset.images?.length ?? 0}枚 · {preset.use_count}回使用
                    </p>
                    <div className="mt-2 flex gap-2">
                      {onSelectForBatch && (
                        <button
                          onClick={() => onSelectForBatch(preset)}
                          className="btn-primary flex-1 !py-1.5 text-xs"
                        >
                          選択
                        </button>
                      )}
                      {tab === "mine" && (
                        <>
                          <button
                            onClick={() => { setEditingId(preset.id); setEditName(preset.name); setEditIsPublic(preset.is_public); }}
                            className="btn-secondary !p-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(preset.id, preset.name)}
                            className="btn-secondary !p-1.5 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
