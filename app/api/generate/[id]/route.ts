export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// モデル → エンドポイント環境変数名（generate/route.ts と同期）
const MODEL_ENDPOINT_MAP: Record<string, string> = {
  "seedream-4.5":       "RUNPOD_ENDPOINT_ID",
  "seedream-4.5-pro":   "RUNPOD_ENDPOINT_ID_PRO",
  "seedream-4.5-turbo": "RUNPOD_ENDPOINT_ID_TURBO",
  "flux1-dev-nsfw":     "RUNPOD_ENDPOINT_ID_FLUX_NSFW",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.RUNPOD_API_KEY;

    // モデル名をクエリパラメータから取得（省略時はデフォルト）
    const model = request.nextUrl.searchParams.get("model") ?? "seedream-4.5";
    const endpointEnvKey = MODEL_ENDPOINT_MAP[model] ?? "RUNPOD_ENDPOINT_ID";
    const endpointId = process.env[endpointEnvKey] || process.env.RUNPOD_ENDPOINT_ID;

    if (!apiKey || !endpointId) {
      return NextResponse.json(
        { error: "RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set." },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://api.runpod.ai/v2/${endpointId}/status/${params.id}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (data.status === "COMPLETED") {
      const output = data.output;
      let imageUrl: string | null = null;

      // Seedream / シンプルworker形式
      if (output?.image_url) {
        imageUrl = output.image_url;
      }
      // ComfyUI worker-comfyui v5+ 形式: { images: [{ filename, type, data }] }
      else if (Array.isArray(output?.images) && output.images.length > 0) {
        const img = output.images[0];
        if (typeof img === "string") {
          imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
        } else if (img?.data) {
          imageUrl = img.data.startsWith("data:")
            ? img.data
            : `data:image/png;base64,${img.data}`;
        }
      }
      // 旧形式 (v4以前): output.message に base64
      else if (output?.message) {
        const msg = output.message as string;
        imageUrl = msg.startsWith("data:") ? msg : `data:image/png;base64,${msg}`;
      }

      if (!imageUrl) {
        return NextResponse.json({ status: "failed", error: "No image found in output." });
      }

      return NextResponse.json({ status: "succeeded", imageUrl });
    }

    if (data.status === "FAILED") {
      return NextResponse.json({
        status: "failed",
        error: data.error || "Image generation failed.",
      });
    }

    return NextResponse.json({ status: data.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status check failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

