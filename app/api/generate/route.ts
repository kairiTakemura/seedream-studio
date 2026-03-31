import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

// ── BytePlus ModelArk エンドポイント ──────────────────────────────
const BYTEPLUS_API_URL =
  "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations";

// Aspect ratio → サイズ文字列（BytePlus形式）
const ASPECT_RATIO_SIZES: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1344x768",
  "9:16": "768x1344",
  "4:3":  "1152x896",
  "3:4":  "896x1152",
};

// Seedream モデル名（BytePlus 公式モデル識別子）
const SEEDREAM_MODEL_MAP: Record<string, string> = {
  "seedream-4.5":       "doubao-seedream-4-5-251128",
  "seedream-4.5-pro":   "doubao-seedream-4-5-251128",
  "seedream-4.5-turbo": "doubao-seedream-4-5-251128",
};

// ComfyUI形式のワークフローJSONを生成（FLUX NSFW 用）
function buildFluxComfyWorkflow(
  prompt: string,
  width: number,
  height: number,
  steps: number,
  _guidance: number
) {
  const seed = Math.floor(Math.random() * 1e15);
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "flux1-dev-fp8.safetensors" } },
    "2": { class_type: "LoraLoader", inputs: { model: ["1", 0], clip: ["1", 1], lora_name: "Flux-Uncensored-V2.safetensors", strength_model: 0.85, strength_clip: 0.85 } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 1], text: prompt } },
    "4": { class_type: "EmptySD3LatentImage", inputs: { width, height, batch_size: 1 } },
    "5": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "6": { class_type: "BasicGuider", inputs: { model: ["2", 0], conditioning: ["3", 0] } },
    "7": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "8": { class_type: "BasicScheduler", inputs: { model: ["2", 0], scheduler: "simple", steps, denoise: 1.0 } },
    "9": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["5", 0], guider: ["6", 0], sampler: ["7", 0], sigmas: ["8", 0], latent_image: ["4", 0] } },
    "10": { class_type: "VAEDecode", inputs: { samples: ["9", 0], vae: ["1", 2] } },
    "11": { class_type: "SaveImage", inputs: { filename_prefix: "flux_nsfw", images: ["10", 0] } },
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData    = await request.formData();
    const prompt      = formData.get("prompt") as string;
    const aspectRatio = formData.get("aspectRatio") as string;
    const model       = (formData.get("model") as string) || "seedream-4.5";

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "プロンプトを入力してください。" },
        { status: 400 }
      );
    }

    // ── FLUX NSFW → 既存の RunPod ロジック ──────────────────────
    if (model === "flux1-dev-nsfw") {
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      const endpointId   = process.env.RUNPOD_ENDPOINT_ID_FLUX_NSFW;

      if (!runpodApiKey || !endpointId) {
        return NextResponse.json(
          { error: "RUNPOD_API_KEY または RUNPOD_ENDPOINT_ID_FLUX_NSFW が設定されていません。" },
          { status: 500 }
        );
      }

      const wh = aspectRatio === "16:9"  ? { width: 1344, height: 768  }
               : aspectRatio === "9:16"  ? { width: 768,  height: 1344 }
               : aspectRatio === "4:3"   ? { width: 1152, height: 896  }
               : aspectRatio === "3:4"   ? { width: 896,  height: 1152 }
               :                           { width: 1024, height: 1024 };

      const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodApiKey}` },
        body: JSON.stringify({
          input: { workflow: buildFluxComfyWorkflow(prompt.trim(), wh.width, wh.height, 28, 3.5) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `RunPod API error: ${res.status}`);
      return NextResponse.json({ id: data.id, status: data.status, backend: "runpod" });
    }

    // ── Seedream 4.5 系 → BytePlus 公式 API ───────────────────────
    const byteplusApiKey = process.env.BYTEPLUS_API_KEY;
    if (!byteplusApiKey) {
      return NextResponse.json(
        { error: "BYTEPLUS_API_KEY が設定されていません。Vercel の環境変数に追加してください。" },
        { status: 500 }
      );
    }

    const byteplusModel = SEEDREAM_MODEL_MAP[model] ?? "doubao-seedream-4-5-251128";
    const size          = ASPECT_RATIO_SIZES[aspectRatio] ?? "1024x1024";

    const res = await fetch(BYTEPLUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${byteplusApiKey}`,
      },
      body: JSON.stringify({
        model:           byteplusModel,
        prompt:          prompt.trim(),
        size,
        n:               1,
        response_format: "url",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || `BytePlus API error: ${res.status}`);
    }

    // BytePlus は同期レスポンス: { data: [{ url: "..." }] }
    const imageUrl = data?.data?.[0]?.url ?? null;
    if (!imageUrl) {
      throw new Error("BytePlus からの画像URLが取得できませんでした。");
    }

    // 既存のポーリングフローをバイパスして直接 imageUrl を返す
    return NextResponse.json({
      id:       "byteplus-sync",
      status:   "COMPLETED",
      imageUrl,
      backend:  "byteplus",
    });

  } catch (err: unknown) {
    console.error("Generation error:", err);
    const message = err instanceof Error ? err.message : "画像生成の開始に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
