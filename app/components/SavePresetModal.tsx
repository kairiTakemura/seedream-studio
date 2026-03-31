"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import { createPreset } from "@/lib/presets";
import { toast } from "sonner";

interface SavePresetModalProps {
  prompt: string;
  aspectRatio: string;
  imageFiles: File[];
  onClose: () => void;
  onSaved: () => void;
}

export default function SavePresetModal({
  prompt,
  aspectRatio,
  imageFiles,
  onClose,
  onSaved,
}: SavePresetModalProps) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("プリセット名を入力してください");
      return;
    }
    setSaving(true);
    try {
      await createPreset(name.trim(), prompt, aspectRatio, isPublic, imageFiles);
      toast.success("プリセットを保存しました！");
      onSaved();
      onClose();
    } catch (err) {
      toast.error("保存に失敗しました: " + (err instanceof Error ? err.message : "不明なエラー"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-surface-800">プリセットとして保存</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-surface-100">
            <X className="h-4 w-4 text-surface-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-700">プリセット名</label>
            <input
              type="text"
              className="input-base w-full"
              placeholder="例: 春服コーデ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="rounded-xl bg-surface-50 p-3 text-sm text-surface-600">
            <p className="font-medium text-surface-700">保存内容</p>
            <p className="mt-1 truncate text-xs text-surface-500">{prompt || "（プロンプトなし）"}</p>
            <p className="mt-0.5 text-xs text-surface-400">
              アスペクト比: {aspectRatio} · 参照画像: {imageFiles.length}枚
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${isPublic ? "bg-accent" : "bg-surface-200"}`}
              onClick={() => setIsPublic(!isPublic)}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
            <span className="text-sm text-surface-700">公開する（他のユーザーが利用可能）</span>
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1 gap-2"
          >
            {saving ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
