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
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const data = await res.json();

    if (data.status === "COMPLETED") {
      // RunPod SDXL worker returns output as array: [{ image: "base64...", seed: ... }]
      // or output.images as base64 strings depending on the worker
      let imageUrl: string | null = null;

      const output = data.output;
      if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        if (typeof first === "string") {
          // Some workers return base64 strings directly
          imageUrl = first.startsWith("data:") ? first : `data:image/png;base64,${first}`;
        } else if (first?.image) {
          // SDXL worker format: { image: "base64...", seed: ... }
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
      }

      if (!imageUrl) {
        console.error("Unexpected RunPod output:", JSON.stringify(output).slice(0, 200));
        return NextResponse.json({
          status: "failed",
          error: "画像の生成結果を取得できませんでした。",
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

    // IN_QUEUE or IN_PROGRESS
    return NextResponse.json({ status: data.status });
  } catch (err: unknown) {
    console.error("Poll error:", err);
    const message =
      err instanceof Error ? err.message : "ステータス確認に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
