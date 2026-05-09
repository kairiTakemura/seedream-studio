"use client";

import { Download, Maximize2, X } from "lucide-react";
import { useState } from "react";

interface GeneratedImageProps {
  url: string;
  filename?: string;
}

export async function downloadImage(url: string, filename?: string) {
  const name = filename || `seedream-${Date.now()}.jpg`;

  const triggerDownload = (blobUrl: string) => {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 1. クロスオリジン画像でも download 属性が効くよう blob 化
  //    まず直接 fetch を試し、CORS で失敗したらサーバー側プロキシ経由で取得
  try {
    let res: Response;
    try {
      res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  } catch {
    // 最終フォールバック: 新規タブで開く（手動保存用、一括では機能しない）
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export default function GeneratedImage({ url, filename }: GeneratedImageProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <div className="animate-fade-in space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-700">生成結果</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="btn-secondary !px-3 !py-2"
              title="拡大表示"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => downloadImage(url, filename)}
              className="btn-primary !px-4 !py-2 !text-xs"
            >
              <Download className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-100 shadow-card">
          <img src={url} alt="生成された画像" className="h-auto w-full object-contain" />
        </div>
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => setIsFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={url}
            alt="生成された画像（拡大）"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute bottom-6 right-6 btn-primary"
            onClick={(e) => { e.stopPropagation(); downloadImage(url, filename); }}
          >
            <Download className="h-4 w-4" />
            保存
          </button>
        </div>
      )}
    </>
  );
}
