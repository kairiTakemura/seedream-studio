import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN が設定されていません。" },
        { status: 500 }
      );
    }

    const replicate = new Replicate({ auth: token });
    const prediction = await replicate.predictions.get(params.id);

    if (prediction.status === "succeeded") {
      let imageUrl: string | null = null;
      const output = prediction.output;

      if (typeof output === "string") {
        imageUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        if (typeof first === "string") {
          imageUrl = first;
        } else if (first && typeof first === "object" && "url" in first) {
          imageUrl = (first as { url: string }).url;
        }
      } else if (output && typeof output === "object" && "url" in output) {
        imageUrl = (output as { url: string }).url;
      }

      return NextResponse.json({ status: "succeeded", imageUrl });
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      return NextResponse.json({
        status: prediction.status,
        error: prediction.error || "画像生成に失敗しました。",
      });
    }

    // still processing
    return NextResponse.json({ status: prediction.status });
  } catch (err: unknown) {
    console.error("Poll error:", err);
    const message =
      err instanceof Error ? err.message : "ステータス確認に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
