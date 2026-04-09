export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
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
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  // 1. 都度課金または初回サブスクリプションの決済完了イベント
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const userId = session.client_reference_id;
    const mode = session.mode; // "payment" or "subscription"
    const planType = session.metadata?.planType; // "one-time", "plus", "pro"

    if (userId && planType) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credits, stamina")
        .eq("id", userId)
        .single();
        
      if (profile) {
        let updateData: any = {
          stripe_customer_id: session.customer,
        };

        if (planType === "one-time") {
          updateData.credits = profile.credits + 100;
        } else if (planType === "plus") {
          updateData.plan = "plus";
          updateData.stamina = 5;
          updateData.stripe_subscription_id = session.subscription || null;
        } else if (planType === "pro") {
          updateData.plan = "pro";
          updateData.stamina = 11;
          updateData.stripe_subscription_id = session.subscription || null;
        }

        await supabaseAdmin
          .from("profiles")
          .update(updateData)
          .eq("id", userId);
      }
    }
  }

  // 2. サブスクリプション更新時の自動決済完了イベント
  if (event.type === "invoice.payment_succeeded") {
    // 決済成功時。月額のスタミナは毎朝5:00のcronで回復するため、ここでのスタミナ追加処理は不要。
    // 決済失敗時などは invoice.payment_failed や customer.subscription.deleted で対応する。
  }

  return NextResponse.json({ received: true });
}
