export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Frontend からは { priceId: string; mode: "payment" | "subscription" } が送られる
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId, mode } = await req.json();

    if (!priceId || !mode) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

    const sessionData: any = {
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode, // "payment" or "subscription"
      success_url: `${baseUrl}/pricing?success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      customer_email: user.email,
      // Create session specific metadata so our webhook knows who bought
      metadata: {
        userId: user.id,
      },
    };

    // client_reference_id is also recommended for webhook validation
    sessionData.client_reference_id = user.id;

    const session = await getStripe().checkout.sessions.create(sessionData);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Session Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
