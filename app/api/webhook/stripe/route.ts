export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

// 管理者権限でDBを更新するためのクライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe Webhook Secret" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  // 1. 都度課金または初回サブスクリプションの決済完了イベント
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const userId = session.client_reference_id;
    const mode = session.mode; // "payment" or "subscription"
    
    // Stripe側の商品メタデータから何クレジット付与するかを取得できれば一番綺麗ですが、
    // 簡易的に price_id や金額から判定することも可能。ここでは決め打ちで付与する例とします。
    // 例：都度100クレジット、サブスク初回は300クレジット
    const creditsToAdd = mode === "subscription" ? 300 : 100;

    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .single();
        
      if (profile) {
        await supabaseAdmin
          .from("profiles")
          .update({ 
            credits: profile.credits + creditsToAdd,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription || null,
          })
          .eq("id", userId);
      }
    }
  }

  // 2. サブスクリプション更新時の自動決済完了イベント
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as any;
    // 初回決済 (billing_reason = subscription_create) は、checkout.session.completed で処理済みとする
    if (invoice.billing_reason === "subscription_cycle") {
      const customerId = invoice.customer;
      
      // customerId から対象のプロフィールを取得
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, credits")
        .eq("stripe_customer_id", customerId)
        .single();

      if (profile) {
        // サブスク更新毎に300クレジット付与
        await supabaseAdmin
          .from("profiles")
          .update({ credits: profile.credits + 300 })
          .eq("id", profile.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
