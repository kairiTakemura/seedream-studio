-- =======================================================
-- 1. profiles テーブルの作成
-- =======================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 10,  -- 新規登録時に最初は10クレジット付与
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =======================================================
-- 2. RLS（Row Level Security）の設定
-- =======================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 閲覧: ログインユーザーは自分のプロフィール（クレジット残高等）のみ閲覧可能
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 更新/挿入/削除: クライアントからは不可（システム/Webhook/トリガーのみ可能）

-- =======================================================
-- 3. 新規ユーザー登録時の自動プロフィール作成トリガー
-- =======================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, credits)
  VALUES (new.id, 10);  -- デフォルトで10クレジット付与
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーがすでに存在する場合は削除してから作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =======================================================
-- 4. クレジット消費用 RPC（安全なトランザクション処理）
-- =======================================================
CREATE OR REPLACE FUNCTION public.deduct_credits(amount integer)
RETURNS boolean AS $$
DECLARE
  current_credits integer;
BEGIN
  -- 現在のクレジットを取得
  SELECT credits INTO current_credits
  FROM public.profiles
  WHERE id = auth.uid();

  -- クレジット不足の場合は false を返す
  IF current_credits < amount THEN
    RETURN false;
  END IF;

  -- クレジットを引く
  UPDATE public.profiles
  SET credits = credits - amount
  WHERE id = auth.uid();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================================================
-- 5. 【初期化用】既存の全ユーザーにプロフィールを一括作成
-- =======================================================
-- 既に登録済みのユーザー（Admin等）にも即座に10クレジットのプロフィールを発行します
INSERT INTO public.profiles (id, credits)
SELECT id, 10 FROM auth.users
ON CONFLICT (id) DO NOTHING;
