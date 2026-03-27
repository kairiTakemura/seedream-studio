export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.RUNPOD_API_KEY;
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;

    if (!apiKey || !endpointId) {
      return NextResponse.json(
        { error: "RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set." },
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
      let imageUrl = null;

      if (output?.image_url) {
        imageUrl = output.image_url;
      } else if (output?.images?.length > 0) {
        const img = output.images[0];
        imageUrl = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
      }

      if (!imageUrl) {
        return NextResponse.json({ status: "failed", error: "No image found." });
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
