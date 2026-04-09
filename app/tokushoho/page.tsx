import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TokushohoPage() {
  return (
    <div className="min-h-screen bg-surface-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 mb-8">
          <ArrowLeft className="h-4 w-4" />
          トップページへ戻る
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <h1 className="text-2xl font-bold text-surface-900 mb-8 px-2 border-l-4 border-indigo-600">
              特定商取引法に基づく表記
            </h1>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">事業者名</div>
                <div className="md:col-span-2 text-surface-600">竹村　海里</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">代表者名</div>
                <div className="md:col-span-2 text-surface-600">竹村　海里</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">所在地</div>
                <div className="md:col-span-2 text-surface-600">
                  〒162-0825<br />
                  東京都新宿区神楽坂3丁目6-10ヒルサイド神楽坂506<br />
                  <span className="text-sm text-surface-400">※省略の表記について：ご請求がありましたら遅滞なく開示いたします。</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">お問い合わせ先</div>
                <div className="md:col-span-2 text-surface-600">
                  メールアドレス: thinglikeabar@gmail.com<br />
                  電話番号: 090-9963-1852<br />
                  <span className="text-sm text-surface-400">※お問い合わせは原則メールにて受け付けております。</span><br />
                  <span className="text-sm text-surface-400">※省略の表記について：ご請求がありましたら遅滞なく開示いたします。</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">販売価格</div>
                <div className="md:col-span-2 text-surface-600">
                  当サイト上の<Link href="/pricing" className="text-indigo-600 hover:underline">料金プランページ</Link>をご参照ください。
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">販売価格以外でお客様に発生する金銭</div>
                <div className="md:col-span-2 text-surface-600">
                  当サイトへのアクセス、画像生成時の通信に必要となる通信費用等は、お客様のご負担となります。
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">お支払方法</div>
                <div className="md:col-span-2 text-surface-600">
                  クレジットカード決済（Stripe決済システムを利用）
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">代金の支払時期</div>
                <div className="md:col-span-2 text-surface-600">
                  ・都度課金：購入手続きの完了時に即時決済されます。<br />
                  ・サブスクリプション（定期課金）：初回は購入手続きの完了時に即時決済され、以降は1ヶ月毎の自動更新時に決済されます。
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-surface-100 pb-4">
                <div className="font-semibold text-surface-700">商品の引き渡し時期・サービス提供時期</div>
                <div className="md:col-span-2 text-surface-600">
                  決済完了後、ただちにご利用可能となります（クレジット・スタミナの即時付与）。
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
                <div className="font-semibold text-surface-700">返品・キャンセルに関する特約</div>
                <div className="md:col-span-2 text-surface-600">
                  デジタルコンテンツという商品の特性上、決済完了後の返品、返金、キャンセルはお受けできません。<br />
                  サブスクリプション（定期課金）の解約については、契約期間の途中で解約手続を行った場合でも、次回更新日までサービスをご利用いただけます。日割り計算による返金等は行っておりません。
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
