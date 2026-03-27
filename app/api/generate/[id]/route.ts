import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.RUNPOD_API_KEY;
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;

    if (!apiKey || !endpointId) {
      return NextResponse.json(
        { error: "RUNPOD_API_KEY または RUNPOD_ENDPOINT_ID が設定されていません。" },
        { status: 500 }
      );
    }

    const url = `https://api.runpod.ai/v2/${endpointId}/status/${params.id}`;
    console.log("[poll] Fetching:", url);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = await res.json();
    console.log("[poll] RunPod status:", data.status);
    console.log("[poll] RunPod output type:", typeof data.output);
    console.log("[poll] RunPod output preview:", JSON.stringify(data.output)?.slice(0, 500));

    if (data.status === "COMPLETED") {
      let imageUrl: string | null = null;
      const output = data.output;

      // Try every known format from RunPod SDXL workers
      if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        console.log("[poll] output[0] type:", typeof first);
        console.log("[poll] output[0] keys:", first && typeof first === "object" ? Object.keys(first) : "N/A");

        if (typeof first === "string") {
          imageUrl = first.startsWith("data:") ? first : `data:image/png;base64,${first}`;
        } else if (first?.image) {
          const img = first.image;
          imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
        } else if (first?.image_url) {
          imageUrl = first.image_url;
        }
      } else if (output?.image) {
        const img = output.image;
        imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
      } else if (output?.images && Array.isArray(output.images)) {
        const img = output.images[0];
        imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
      } else if (typeof output === "object" && output !== null) {
        // Log all keys so we can see what format it uses
        console.log("[poll] output keys:", Object.keys(output));
      }

      if (!imageUrl) {
        console.error("[poll] Could not extract image. Full output keys:",
          output && typeof output === "object" ? Object.keys(output) : typeof output
        );
        return NextResponse.json({
          status: "failed",
          error: "画像の取得に失敗しました。出力形式が不明です。",
          debug: {
            outputType: typeof output,
            isArray: Array.isArray(output),
            keys: output && typeof output === "object" && !Array.isArray(output) ? Object.keys(output) : null,
            firstItemKeys: Array.isArray(output) && output[0] && typeof output[0] === "object" ? Object.keys(output[0]) : null,
            preview: JSON.stringify(output)?.slice(0, 300),
          },
        });
      }

      console.log("[poll] Image URL length:", imageUrl.length);
      return NextResponse.json({ status: "succeeded", imageUrl });
    }

    if (data.status === "FAILED") {
      console.error("[poll] Job failed:", data.error);
      return NextResponse.json({
        status: "failed",
        error: data.error || "画像生成に失敗しました。",
      });
    }

    // IN_QUEUE or IN_PROGRESS
    console.log("[poll] Still processing:", data.status);
    return NextResponse.json({ status: data.status });
  } catch (err: unknown) {
    console.error("[poll] Exception:", err);
    const message =
      err instanceof Error ? err.message : "ステータス確認に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
