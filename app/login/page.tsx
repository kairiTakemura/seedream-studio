"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("メールアドレスとパスワードを入力してください");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("ログインしました");
      router.push("/");
      router.refresh(); // Refresh session globally
    } catch (error: any) {
      toast.error(error.message || "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("メールアドレスとパスワードを入力してください");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      toast.success("サインアップ完了: 確認メールを確認してください");
    } catch (error: any) {
      toast.error(error.message || "サインアップに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Googleログインに失敗しました");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 text-white">
      <div className="w-full max-w-sm space-y-6 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">ログイン</h1>
          <p className="text-sm text-gray-400">
            プリセットの保存や生成を行うにはログインしてください
          </p>
        </div>

        <form className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              placeholder="miku@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300" htmlFor="password">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              onClick={handleLogin}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={handleSignup}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-md border border-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              新規登録
            </button>
          </div>
        </form>

        <div className="relative pt-2 pb-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#111113] px-2 text-gray-400 rounded-full">または</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center bg-white hover:bg-gray-100 text-zinc-900 px-4 py-2.5 rounded-md text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-zinc-900" />
          ) : (
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Googleでログイン
        </button>
      </div>
    </div>
  );
}
