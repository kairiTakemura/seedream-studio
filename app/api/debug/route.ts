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

    const data = await res.json();

    if (data.status === "COMPLETED") {
      const output = data.output;
      let imageUrl: string | null = null;

      if (output?.image_url) {
        imageUrl = output.image_url;
      } else if (output?.images && Array.isArray(output.images) && output.images.length > 0) {
        const img = output.images[0];
        imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
      }

      if (!imageUrl) {
        return NextResponse.json({
          status: "failed",
          error: "画像の取得に失敗しました。",
        });
      }

      return NextResponse.json({ status: "succeeded", imageUrl });
    }

    if (data.status === "FAILED") {
      return NextResponse.json({
        status: "failed",
        error: data.error || "画像生成に失敗しました。",
      });
    }

    return NextResponse.json({ status: data.status });
  } catch (err: unknown) {
    console.error("[poll] Exception:", err);
    const message =
      err instanceof Error ? err.message : "ステータス確認に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
`
