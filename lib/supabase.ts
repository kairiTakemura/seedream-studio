import { createBrowserClient } from "@supabase/ssr";
import { createClient as createFallbackClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 旧・互換用 (基本的にはServer/Browserクライアントを使い分ける)
export const supabase = createFallbackClient(supabaseUrl, supabaseAnonKey);

export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export type Preset = {
  id: string;
  name: string;
  prompt: string;
  aspect_ratio: string;
  is_public: boolean;
  use_count: number;
  created_at: string;
  user_id?: string;
  images: PresetImage[];
};

export type PresetImage = {
  id: string;
  preset_id: string;
  storage_path: string;
  order_index: number;
  url?: string; // 署名付きURL（取得後にセット）
};
