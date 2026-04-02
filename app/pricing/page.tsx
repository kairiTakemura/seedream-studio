'use client';

import { useState } from 'react';

type CheckoutMode = 'payment' | 'subscription';

type Plan = {
  name: string;
  price: string;
  summary: string;
  detail: string;
  target: string;
  features: string[];
  cta: string;
  mode: CheckoutMode;
  priceId: string;
  recommended?: boolean;
  badge?: string;
  appeal?: string;
  kind: string;
  monthlyCapacityLabel: string;
};

const sharedFeatures = [
  '一括生成',
  'プリセット管理',
  'プリセット保存数無制限',
  'ワークフロー共有 / 公開',
];

const plans: Plan[] = [
  {
    name: '都度課金',
    price: '1,980円',
    summary: '100クレジット',
    detail: 'クレジットは無期限',
    monthlyCapacityLabel: '好きなタイミングで消費',
    target: '必要な時だけ使いたい方向け',
    features: [
      '100クレジット付与',
      '有効期限なし',
      '必要な時だけ追加購入できる',
      'まずは単発で試したい人に最適',
    ],
    cta: '100クレジットを購入',
    mode: 'payment',
    priceId: 'price_credit_100', // TODO: Stripeの実際の価格IDに変更
    kind: '買い切り',
  },
  {
    name: 'Plus',
    price: '1,480円 / 月',
    summary: '毎日 5スタミナ',
    detail: '1スタミナ = 1枚',
    monthlyCapacityLabel: '最大 155枚 / 月',
    target: '毎日少し試したい方向け',
    features: [
      '毎日5スタミナを自動回復',
      '軽く継続利用したい人向け',
      'シンプルで始めやすい料金設計',
      'まずは日常利用を習慣化したい人におすすめ',
    ],
    cta: 'Plusではじめる',
    mode: 'subscription',
    priceId: 'price_plus_monthly', // TODO: Stripeの実際の価格IDに変更
    kind: '月額サブスク',
  },
  {
    name: 'Pro',
    price: '2,980円 / 月',
    summary: '毎日 11スタミナ',
    detail: '1スタミナ = 1枚',
    monthlyCapacityLabel: '最大 341枚 / 月',
    target: '毎日使う個人クリエイター向け',
    features: [
      '毎日11スタミナを自動回復',
      '継続的な制作に最適',
      '個人利用で最もバランスが良い',
      '日々の制作フローに組み込みやすい',
    ],
    cta: 'Proではじめる',
    mode: 'subscription',
    priceId: 'price_pro_monthly', // TODO: Stripeの実際の価格IDに変更
    recommended: true,
    badge: '一番人気',
    appeal: '月150枚以上使うなら最もお得',
    kind: '月額サブスク',
  },
];

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 flex-none"
    >
      <circle cx="10" cy="10" r="9" className="fill-indigo-50" />
      <path
        d="M6 10.2 8.5 12.7 14 7.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-indigo-600"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M12 2.75 14.7 9.3 21.25 12l-6.55 2.7L12 21.25l-2.7-6.55L2.75 12 9.3 9.3 12 2.75Z"
        className="fill-indigo-500"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M12 8v4m0 4h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PricingPage() {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const isAnyLoading = loadingPriceId !== null;

  const handleCheckout = async (priceId: string, mode: CheckoutMode) => {
    if (isAnyLoading) return;

    try {
      setLoadingPriceId(priceId);
      console.log('checkout start', { priceId, mode });
      
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      // Stripe Checkoutへリダイレクト
      window.location.href = data.url;
    } catch (error: any) {
      console.error('checkout error', error);
      alert(error.message || '決済の準備に失敗しました');
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F8FC] text-slate-800">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E5EAF3] bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
            <SparkIcon />
            <span>シンプルで選びやすい料金設計</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            料金プラン
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
            使い方に合わせて、都度課金または毎日使えるサブスクを選べます
          </p>
        </header>

        <section
          aria-labelledby="shared-features"
          className="mx-auto mt-8 max-w-6xl rounded-3xl border border-[#E5EAF3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)] sm:p-6"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <SparkIcon />
            </div>
            <div>
              <h2 id="shared-features" className="text-sm font-semibold text-slate-900">
                全プラン共通で使える機能
              </h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                便利機能はプランに関係なく、すべてのユーザーが利用できます
              </p>
            </div>
          </div>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sharedFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 rounded-2xl border border-[#EEF2F8] bg-[#FAFBFE] px-4 py-3 text-sm text-slate-600"
              >
                <span className="text-indigo-600">
                  <CheckIcon />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-label="料金プラン一覧"
          className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {plans.map((plan) => {
            const isLoading = loadingPriceId === plan.priceId;
            const isRecommended = !!plan.recommended;

            return (
              <article
                key={plan.priceId}
                className={[
                  'relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all',
                  'hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)]',
                  isRecommended
                    ? 'border-indigo-200 ring-1 ring-indigo-200 shadow-[0_12px_32px_rgba(91,107,255,0.10)]'
                    : 'border-[#E5EAF3]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center rounded-full border border-[#E7ECF5] bg-[#F8FAFF] px-2.5 py-1 text-[11px] font-medium text-slate-500">
                      {plan.kind}
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-slate-900">
                      {plan.name}
                    </h2>
                  </div>

                  {isRecommended ? (
                    <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
                      {plan.badge}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 border-b border-[#EEF2F8] pb-5">
                  <div className="text-3xl font-semibold tracking-tight text-slate-900">
                    {plan.price}
                  </div>

                  <p className="mt-3 text-sm font-medium text-slate-700">
                    {plan.summary}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">{plan.detail}</p>

                  <div className="mt-4 inline-flex items-center rounded-full border border-[#E7ECF5] bg-[#F8FAFF] px-3 py-1.5 text-xs font-medium text-slate-600">
                    {plan.monthlyCapacityLabel}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {plan.target}
                  </p>

                  {plan.appeal ? (
                    <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-sm font-medium text-indigo-700">
                      {plan.appeal}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col">
                  <ul
                    className="mt-5 space-y-3"
                    aria-label={`${plan.name}の機能一覧`}
                  >
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm text-slate-600"
                      >
                        <span className="mt-0.5 text-indigo-600">
                          <CheckIcon />
                        </span>
                        <span className="leading-6">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleCheckout(plan.priceId, plan.mode);
                      }}
                      disabled={isAnyLoading}
                      aria-busy={isLoading}
                      aria-disabled={isAnyLoading}
                      className={[
                        'inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2',
                        isRecommended
                          ? 'bg-[#5B6BFF] text-white hover:bg-[#4C5AF5] disabled:bg-indigo-300'
                          : 'border border-[#E2E8F2] bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 disabled:bg-slate-50 disabled:text-slate-400',
                        isAnyLoading ? 'cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {isLoading ? '処理中...' : plan.cta}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section
          aria-labelledby="pricing-notes"
          className="mx-auto mt-8 max-w-5xl rounded-3xl border border-[#E5EAF3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)] sm:p-6"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <InfoIcon />
            </div>
            <h2 id="pricing-notes" className="text-sm font-semibold text-slate-900">
              ご利用に関する注記
            </h2>
          </div>

          <ul className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <li className="rounded-2xl border border-[#EEF2F8] bg-[#FAFBFE] px-4 py-3">
              1スタミナ = 画像1枚生成
            </li>
            <li className="rounded-2xl border border-[#EEF2F8] bg-[#FAFBFE] px-4 py-3">
              スタミナは毎朝5:00に回復
            </li>
            <li className="rounded-2xl border border-[#EEF2F8] bg-[#FAFBFE] px-4 py-3">
              未使用スタミナは翌朝5:00に失効し、繰り越されません
            </li>
            <li className="rounded-2xl border border-[#EEF2F8] bg-[#FAFBFE] px-4 py-3">
              都度課金のクレジットは無期限で利用可能
            </li>
          </ul>

          <p className="mt-4 text-xs leading-5 text-slate-400">
            ※ サブスクの月間枚数表示は31日換算での最大値です。
          </p>
        </section>
      </section>
    </main>
  );
}
