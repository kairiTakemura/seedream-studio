import { supabase, type Preset } from "./supabase";

// プリセット一覧取得（画像URL付き）
export async function fetchPresets(publicOnly = false): Promise<Preset[]> {
  const query = supabase
    .from("presets")
    .select("*, images:preset_images(id, preset_id, storage_path, order_index)")
    .order("created_at", { ascending: false });

  if (publicOnly) query.eq("is_public", true);

  const { data, error } = await query;
  if (error) throw error;

  // 各画像のpublic URLを付与
  const presets = (data || []).map((preset) => ({
    ...preset,
    images: (preset.images || [])
      .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      .map((img: { id: string; preset_id: string; storage_path: string; order_index: number }) => ({
        ...img,
        url: supabase.storage.from("preset-images").getPublicUrl(img.storage_path).data.publicUrl,
      })),
  }));

  return presets;
}

// プリセット作成
export async function createPreset(
  name: string,
  prompt: string,
  aspectRatio: string,
  isPublic: boolean,
  imageFiles: File[]
): Promise<Preset> {
  // 1. presetsテーブルに挿入
  const { data: preset, error: presetError } = await supabase
    .from("presets")
    .insert({ name, prompt, aspect_ratio: aspectRatio, is_public: isPublic })
    .select()
    .single();

  if (presetError) throw presetError;

  // 2. 画像をStorageにアップロード
  const imageRecords = [];
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${preset.id}/${i}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("preset-images")
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;
    imageRecords.push({ preset_id: preset.id, storage_path: path, order_index: i });
  }

  // 3. preset_imagesテーブルに挿入
  if (imageRecords.length > 0) {
    const { error: imgError } = await supabase
      .from("preset_images")
      .insert(imageRecords);
    if (imgError) throw imgError;
  }

  return { ...preset, images: imageRecords };
}

// プリセット更新
export async function updatePreset(
  id: string,
  name: string,
  prompt: string,
  aspectRatio: string,
  isPublic: boolean
): Promise<void> {
  const { error } = await supabase
    .from("presets")
    .update({ name, prompt, aspect_ratio: aspectRatio, is_public: isPublic, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// プリセット削除
export async function deletePreset(id: string): Promise<void> {
  // Storage内の画像も削除
  const { data: images } = await supabase
    .from("preset_images")
    .select("storage_path")
    .eq("preset_id", id);

  if (images && images.length > 0) {
    await supabase.storage
      .from("preset-images")
      .remove(images.map((img) => img.storage_path));
  }

  const { error } = await supabase.from("presets").delete().eq("id", id);
  if (error) throw error;
}

// 使用回数インクリメント
export async function incrementUseCount(id: string): Promise<void> {
  await supabase.rpc("increment_use_count", { preset_id: id });
}
