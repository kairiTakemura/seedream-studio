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

    const text = await res.text();
    const statusMatch = text.match(/"status"\s*:\s*"([^"]+)"/);
    const status = statusMatch ? statusMatch[1] : "UNKNOWN";

    if (status === "COMPLETED") {
      const urlMatch = text.match(/"image_url"\s*:\s*"([^"]+)"/);
      if (urlMatch && urlMatch[1]) {
        return NextResponse.json({ status: "succeeded", imageUrl: urlMatch[1] });
      }

      try {
        const data = JSON.parse(text);
        const output = data?.output;
        if (output?.images && Array.isArray(output.images) && output.images.length > 0) {
          const img = output.images[0];
          const imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
          return NextResponse.json({ status: "succeeded", imageUrl });
        }
      } catch {}

      return NextResponse.json({
        status: "failed",
        error: "画像の取得に失敗しました。",
      });
    }

    if (status === "FAILED") {
      const errorMatch = text.match(/"error"\s*:\s*"([^"]+)"/);
      return NextResponse.json({
        status: "failed",
        error: errorMatch ? errorMatch[1] : "画像生成に失敗しました。",
      });
    }

    return NextResponse.json({ status });
  } catch (err: unknown) {
    console.error("[poll] Exception:", err);
    const message =
      err instanceof Error ? err.message : "ステータス確認に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
