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

    const res = await fetch(
      `https://api.runpod.ai/v2/${endpointId}/status/${params.id}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!res.body) {
      return NextResponse.json({ error: "No response body" }, { status: 500 });
    }

    // Stream response - read only first ~50KB to find status and image_url
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });

      // Check status
      const statusMatch = accumulated.match(/"status"\s*:\s*"([^"]+)"/);
      if (!statusMatch) continue;

      const status = statusMatch[1];

      if (status !== "COMPLETED") {
        reader.cancel();
        if (status === "FAILED") {
          const errorMatch = accumulated.match(/"error"\s*:\s*"([^"]+)"/);
          return NextResponse.json({
            status: "failed",
            error: errorMatch ? errorMatch[1] : "画像生成に失敗しました。",
          });
        }
        return NextResponse.json({ status });
      }

      // COMPLETED - look for image_url
      const urlMatch = accumulated.match(/"image_url"\s*:\s*"([^"]+)"/);
      if (urlMatch && urlMatch[1]) {
        reader.cancel();
        return NextResponse.json({ status: "succeeded", imageUrl: urlMatch[1] });
      }

      // Stop reading after 50KB to avoid timeout
      if (accumulated.length > 50000) {
        reader.cancel();
        break;
      }
    }

    // If we got here with COMPLETED but no image_url, try images array
    const imgMatch = accumulated.match(/"images"\s*:\s*\["([^"]{0,200})/);
    if (imgMatch) {
      return NextResponse.json({
        status: "failed",
        error: "画像はbase64形式で返されましたが、サイズが大きすぎます。",
      });
    }

    return NextResponse.json({ status: "failed", error: "画像の取得に失敗しました。" });
  } catch (err: unknown) {
    console.error("[poll] Exception:", err);
    const message =
      err instanceof Error ? err.message : "ステータス確認に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
