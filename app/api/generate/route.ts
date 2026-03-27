import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

// Vercel Hobby plan: 10s max — this endpoint just kicks off the prediction
export const maxDuration = 10;

const ASPECT_RATIO_MAP: Record<string, string> = {
  "1:1": "1:1",
  "16:9": "16:9",
  "9:16": "9:16",
  "4:3": "4:3",
  "3:4": "3:4",
};

export async function POST(request: NextRequest) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN が設定されていません。" },
        { status: 500 }
      );
    }

    const replicate = new Replicate({ auth: token });

    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const aspectRatio = formData.get("aspectRatio") as string;
    const referenceImages = formData.getAll("referenceImages") as File[];

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "プロンプトを入力してください。" },
        { status: 400 }
      );
    }

    // Convert reference images to data URIs
    const imageDataUris: string[] = [];
    for (const file of referenceImages) {
      if (file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString("base64");
        const mimeType = file.type || "image/png";
        imageDataUris.push(`data:${mimeType};base64,${base64}`);
      }
    }

    const input: Record<string, unknown> = {
      prompt: prompt.trim(),
      aspect_ratio: ASPECT_RATIO_MAP[aspectRatio] || "1:1",
    };

    // Create prediction WITHOUT waiting — returns immediately
    const prediction = await replicate.predictions.create({
      model: "bytedance/seedream-4.5",
      input,
    });

    return NextResponse.json({ id: prediction.id, status: prediction.status });
  } catch (err: unknown) {
    console.error("Generation error:", err);
    const message =
      err instanceof Error ? err.message : "画像生成の開始に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
