-- ============================================================================
-- Migration: presets テーブルに base_count カラムを追加
-- ----------------------------------------------------------------------------
-- 目的: バリエーション生成プリセットで「先頭何枚をベース画像とみなすか」を
--       保存できるようにする。既存プリセットは base_count = 1 として扱う。
--
-- 実行方法: Supabase ダッシュボード → SQL Editor にコピペして Run
-- ============================================================================

ALTER TABLE presets
  ADD COLUMN IF NOT EXISTS base_count integer NOT NULL DEFAULT 1;

-- 任意: 既存データを 1 で確定 (DEFAULT が効くので通常は不要)
UPDATE presets SET base_count = 1 WHERE base_count IS NULL;
