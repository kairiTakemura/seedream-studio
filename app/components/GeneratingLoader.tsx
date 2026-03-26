"use client";

import { Sparkles } from "lucide-react";

export default function GeneratingLoader() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-surface-700">生成中…</h2>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-surface-200 bg-surface-100">
        <div className="flex aspect-square max-h-[480px] w-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-accent animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-accent/5 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-surface-600">
                Seedream 4.5 で画像を生成しています
              </p>
              <p className="mt-1 text-xs text-surface-400">
                通常30秒〜2分ほどかかります
              </p>
            </div>
            {/* Progress bar animation */}
            <div className="h-1 w-48 overflow-hidden rounded-full bg-surface-200">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-accent/60 shimmer-bg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
