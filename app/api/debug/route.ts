import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  const jobId = request.nextUrl.searchParams.get("id");

  if (!apiKey || !endpointId || !jobId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const text = await res.text();

  // Return just the status and output structure, NOT the full base64
  try {
    const data = JSON.parse(text);
    return NextResponse.json({
      status: data.status,
      outputType: typeof data.output,
      isArray: Array.isArray(data.output),
      outputKeys: data.output && typeof data.output === "object" && !Array.isArray(data.output)
        ? Object.keys(data.output) : null,
      firstItemKeys: Array.isArray(data.output) && data.output[0] && typeof data.output[0] === "object"
        ? Object.keys(data.output[0]) : null,
      firstItemImageLength: Array.isArray(data.output) && data.output[0]?.image
        ? data.output[0].image.length : null,
      responseSize: text.length,
      error: data.error,
    });
  } catch {
    return NextResponse.json({
      parseError: true,
      responseSize: text.length,
      preview: text.slice(0, 500),
    });
  }
}
