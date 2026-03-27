export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";

const SIZES: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RUNPOD_API_KEY;
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;

    if (!apiKey || !endpointId) {
      return NextResponse.json(
        { error: "RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const aspectRatio = formData.get("aspectRatio") as string;

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Please enter a prompt." },
        { status: 400 }
      );
    }

    const size = SIZES[aspectRatio] || SIZES["1:1"];

    const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          prompt: prompt.trim(),
          width: size.width,
          height: size.height,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        },
      }),
    });

    const data = await res.json();

    if (data.status === "COMPLETED") {
      const output = data.output;
      let imageUrl = null;

      if (output?.image_url) {
        imageUrl = output.image_url;
      } else if (output?.images?.length > 0) {
        const img = output.images[0];
        imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
      }

      if (!imageUrl) {
        return NextResponse.json({ error: "No image in output." }, { status: 500 });
      }

      return NextResponse.json({ imageUrl });
    }

    return NextResponse.json(
      { error: data.error || `Job status: ${data.status}` },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
