-- =======================================================
-- 1. profiles テーブルの作成
-- =======================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 10,  -- 新規登録時に最初は10クレジット付与
  stamina integer NOT NULL DEFAULT 0,   -- 日次回復スタミナ
  plan text NOT NULL DEFAULT 'free',    -- 'free', 'plus', 'pro'
  is_admin boolean NOT NULL DEFAULT false, -- 管理者フラグ
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- すでにテーブルが存在する場合のために、不足しているカラムを追加
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stamina') THEN
    ALTER TABLE public.profiles ADD COLUMN stamina integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plan') THEN
    ALTER TABLE public.profiles ADD COLUMN plan text NOT NULL DEFAULT 'free';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_admin') THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =======================================================
-- 2. RLS（Row Level Security）の設定
-- =======================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 閲覧: ログインユーザーは自分のプロフィール（クレジット残高等）のみ閲覧可能
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
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
  current_stamina integer;
  amount_left integer;
BEGIN
  -- 現在のクレジット・スタミナを取得
  SELECT credits, stamina INTO current_credits, current_stamina
  FROM public.profiles
  WHERE id = auth.uid();

  amount_left := amount;

  -- まずスタミナから消費
  IF current_stamina >= amount_left THEN
    UPDATE public.profiles
    SET stamina = stamina - amount_left
    WHERE id = auth.uid();
    RETURN true;
  END IF;

  amount_left := amount_left - current_stamina;

  -- 足りない分はクレジットから消費
  IF current_credits >= amount_left THEN
    UPDATE public.profiles
    SET stamina = 0,
        credits = credits - amount_left
    WHERE id = auth.uid();
    RETURN true;
  END IF;

  -- 両方合わせても足りない場合
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================================================
-- 5. 【初期化用】既存の全ユーザーにプロフィールを一括作成
-- =======================================================
-- 既に登録済みのユーザーにも即座にプロフィールを発行
INSERT INTO public.profiles (id, credits, stamina, plan, is_admin)
SELECT id, 10, 0, 'free', false FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- =======================================================
-- 6. スタミナの毎朝5:00リセット処理 (pg_cron)
-- =======================================================
-- 拡張機能 pg_cron を有効化
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.reset_daily_stamina()
RETURNS void AS $$
BEGIN
  -- Plusプランの人はスタミナを5に
  UPDATE public.profiles
  SET stamina = 5
  WHERE plan = 'plus';

  -- Proプランの人はスタミナを11に
  UPDATE public.profiles
  SET stamina = 11
  WHERE plan = 'pro';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- スケジュールの設定 (毎日 JST 05:00 = UTC 20:00)
-- 既存のジョブがあれば解除
DO $$ 
BEGIN
  PERFORM cron.unschedule('reset-stamina-job');
EXCEPTION WHEN OTHERS THEN
  -- 無視
END $$;

SELECT cron.schedule('reset-stamina-job', '0 20 * * *', 'SELECT public.reset_daily_stamina()');
