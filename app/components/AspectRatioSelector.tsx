"use client";

import { cn } from "@/lib/utils";

const RATIOS = [
  { label: "1:1", value: "1:1", w: 1, h: 1 },
  { label: "16:9", value: "16:9", w: 16, h: 9 },
  { label: "9:16", value: "9:16", w: 9, h: 16 },
  { label: "4:3", value: "4:3", w: 4, h: 3 },
  { label: "3:4", value: "3:4", w: 3, h: 4 },
] as const;

interface AspectRatioSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function AspectRatioSelector({
  value,
  onChange,
}: AspectRatioSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-surface-700">
        アスペクト比
      </label>
      <div className="flex flex-wrap gap-2">
        {RATIOS.map((ratio) => {
          const isActive = value === ratio.value;
          // Scale the preview box to a reasonable visual size
          const maxDim = 28;
          const scale =
            maxDim / Math.max(ratio.w, ratio.h);
          const w = Math.round(ratio.w * scale);
          const h = Math.round(ratio.h * scale);

          return (
            <button
              key={ratio.value}
              type="button"
              onClick={() => onChange(ratio.value)}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-xl px-4 py-3 transition-all duration-200",
                "border",
                isActive
                  ? "border-accent bg-accent/5 shadow-sm shadow-accent/10"
                  : "border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50"
              )}
            >
              <div
                className={cn(
                  "rounded-[4px] border-2 transition-colors",
                  isActive
                    ? "border-accent bg-accent/10"
                    : "border-surface-300 bg-surface-100 group-hover:border-surface-400"
                )}
                style={{ width: `${w}px`, height: `${h}px` }}
              />
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  isActive ? "text-accent" : "text-surface-500"
                )}
              >
                {ratio.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
