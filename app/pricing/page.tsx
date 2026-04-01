"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Zap, ArrowRight, Loader2 } from "lucide-react";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, mode: "payment" | "subscription") => {
    setLoading(priceId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      // Stripe Checkoutへリダイレクト
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "決済の準備に失敗しました");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Seedream 4.5
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-surface-900">
            シンプルで明瞭な料金プラン
          </h1>
          <p className="text-lg text-surface-500 max-w-2xl mx-auto">
            ご自身の利用頻度に合わせて、都度購入（買い切り）とお得な月額プランをお選びいただけます。
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          
          {/* 都度課金プラン */}
          <div className="bg-white rounded-3xl p-8 border border-surface-200 shadow-sm flex flex-col hover:border-blue-200 hover:shadow-md transition">
            <h3 className="text-xl font-bold text-surface-900 mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              必要な分だけ
            </h3>
            <p className="text-surface-500 text-sm mb-6">試しに使ってみたい方や、たまに生成する方向け</p>
            
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-surface-900">¥500</span>
              <span className="text-surface-500 font-medium"> / 回</span>
            </div>
            
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex gap-3 text-sm text-surface-700">
                <Check className="w-5 h-5 text-blue-600 shrink-0" />
                <span><strong className="text-surface-900">100</strong> クレジット付与</span>
              </li>
              <li className="flex gap-3 text-sm text-surface-700">
                <Check className="w-5 h-5 text-blue-600 shrink-0" />
                <span>買い切り・有効期限なし</span>
              </li>
            </ul>

            <button
              onClick={() => handleCheckout("PRICE_ID_PAYG", "payment")}
              disabled={loading !== null}
              className="w-full btn-secondary py-3 flex items-center justify-center gap-2 relative"
            >
              {loading === "PRICE_ID_PAYG" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>100クレジットを購入 <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {/* 月額サブスクリプション */}
          <div className="bg-gradient-to-b from-blue-900 to-blue-950 rounded-3xl p-8 border border-blue-800 shadow-xl flex flex-col relative overflow-hidden transform md:-translate-y-4">
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              一番お得
            </div>

            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-300" />
              月額プラン
            </h3>
            <p className="text-blue-200 text-sm mb-6">定期的に画像を大量に生成するクリエイター向け</p>
            
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-white">¥980</span>
              <span className="text-blue-300 font-medium"> / 月</span>
            </div>
            
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex gap-3 text-sm text-blue-100">
                <Check className="w-5 h-5 text-blue-400 shrink-0" />
                <span>毎月 <strong className="text-white">300</strong> クレジット付与</span>
              </li>
              <li className="flex gap-3 text-sm text-blue-100">
                <Check className="w-5 h-5 text-blue-400 shrink-0" />
                <span>都度購入より約2,000円分お得</span>
              </li>
              <li className="flex gap-3 text-sm text-blue-100">
                <Check className="w-5 h-5 text-blue-400 shrink-0" />
                <span>いつでも解約可能</span>
              </li>
            </ul>

            <button
              onClick={() => handleCheckout("PRICE_ID_SUBSCRIPTION", "subscription")}
              disabled={loading !== null}
              className="w-full bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {loading === "PRICE_ID_SUBSCRIPTION" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>月額プランに登録 <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

        </div>
        
        <p className="text-center text-xs text-surface-400 mt-8">
          ※ 決済には Stripe を使用しており、安全に処理されます。テストモード中は架空のカード番号でテスト可能です。
        </p>
      </div>
    </div>
  );
}
