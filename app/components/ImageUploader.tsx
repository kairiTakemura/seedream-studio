"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

export default function ImageUploader({
  files,
  onChange,
  maxFiles = 5,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const accepted = Array.from(incoming).filter((f) =>
        f.type.startsWith("image/")
      );
      const combined = [...files, ...accepted].slice(0, maxFiles);
      onChange(combined);
    },
    [files, maxFiles, onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index));
    },
    [files, onChange]
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-surface-700">
        参照画像
        <span className="ml-2 text-xs font-normal text-surface-400">
          任意 · 最大{maxFiles}枚
        </span>
      </label>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200",
          "flex flex-col items-center justify-center gap-3 py-8 px-4",
          isDragging
            ? "border-accent bg-accent/5 scale-[1.01]"
            : "border-surface-200 bg-surface-50/50 hover:border-surface-300 hover:bg-surface-100/50",
          files.length >= maxFiles && "pointer-events-none opacity-50"
        )}
      >
        <div
          className={cn(
            "rounded-xl p-3 transition-colors",
            isDragging ? "bg-accent/10" : "bg-surface-100"
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5",
              isDragging ? "text-accent" : "text-surface-400"
            )}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-surface-600">
            ドラッグ＆ドロップ または{" "}
            <span className="text-accent">クリックして選択</span>
          </p>
          <p className="mt-1 text-xs text-surface-400">
            PNG, JPG, WebP に対応
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Thumbnail previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="group relative h-20 w-20 overflow-hidden rounded-xl border border-surface-200 bg-surface-100 shadow-sm"
            >
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-800 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {files.length < maxFiles && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-surface-200 text-surface-400 transition-colors hover:border-accent hover:text-accent"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
