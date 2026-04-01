-- Supabase Auth 実装に伴う変更スクリプト
-- ※ Supabase Studio の SQL Editor に貼り付けて実行してください

-- 1. presets テーブルに user_id カラムを追加 (NULL可: 既存データ救済用)
ALTER TABLE public.presets ADD COLUMN user_id uuid references auth.users(id);

-- 2. RLS(Row Level Security)の再設定 --

-- 一旦既存の全許可ポリシーを削除
DROP POLICY IF EXISTS "allow all" ON public.presets;
DROP POLICY IF EXISTS "allow all" ON public.preset_images;

-- presets 用ポリシー
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;

-- 閲覧: 公開設定(is_public=true) または 自分自身のプリセット、または既存データ(user_id IS NULL)は閲覧可能
CREATE POLICY "Viewable by everyone if public or owned" 
ON public.presets FOR SELECT 
USING (is_public = true OR user_id = auth.uid() OR user_id IS NULL);

-- 作成: ログインユーザーのみ（かつ自分のuser_idとしてのみ作成可）
CREATE POLICY "Users can insert their own presets" 
ON public.presets FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

-- 更新: 自分のプリセットのみ更新可
CREATE POLICY "Users can update their own presets" 
ON public.presets FOR UPDATE TO authenticated 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- 削除: 自分のプリセットのみ削除可
CREATE POLICY "Users can delete their own presets" 
ON public.presets FOR DELETE TO authenticated 
USING (user_id = auth.uid());


-- preset_images 用ポリシー
ALTER TABLE public.preset_images ENABLE ROW LEVEL SECURITY;

-- 閲覧: 親プリセットが閲覧可能なら画像データも閲覧可能
CREATE POLICY "Images Viewable if preset is viewable" 
ON public.preset_images FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.presets 
    WHERE presets.id = preset_images.preset_id 
    AND (presets.is_public = true OR presets.user_id = auth.uid() OR presets.user_id IS NULL)
  )
);

-- 追加/更新/削除: 親プリセットが自分のものなら操作可能
CREATE POLICY "Users can modify images of their own presets" 
ON public.preset_images FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.presets 
    WHERE presets.id = preset_images.preset_id AND presets.user_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.presets 
    WHERE presets.id = preset_images.preset_id AND presets.user_id = auth.uid()
  )
);

-- 3. Storage のポリシー再設定（preset-images バケット）
-- 一旦既存の全許可ポリシーを削除
DROP POLICY IF EXISTS "allow all storage" ON storage.objects;

-- 閲覧: 誰でも画像の閲覧（ダウンロード）は可能
CREATE POLICY "Anyone can view images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'preset-images');

-- アップロード: ログインユーザーのみ許可
CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'preset-images');

-- 削除: ログインユーザーのみ許可
CREATE POLICY "Authenticated users can delete images" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'preset-images');

-- --------------------------------------------------------
-- 【おまけ】既存のプリセットを自分のアカウントに紐づけるスクリプト
-- アプリで自分のアカウント（Admin）を作成した後に、以下のSQLを実行してください。
-- 'YOUR_USER_ID_HERE' の部分を、Supabaseの Authentication > Users 画面で取得した自分の User UID に書き換えてください。
-- 
-- UPDATE public.presets 
-- SET user_id = 'YOUR_USER_ID_HERE' 
-- WHERE user_id IS NULL;
-- --------------------------------------------------------
