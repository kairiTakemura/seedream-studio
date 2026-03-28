import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

// Aspect ratio → pixel dimensions (SDXL optimized resolutions)
const ASPECT_RATIO_SIZES: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
};

// Model → RunPod endpoint env var name
const MODEL_ENDPOINT_MAP: Record<string, string> = {
  // Seedream
  "seedream-4.5":       "RUNPOD_ENDPOINT_ID",
  "seedream-4.5-pro":   "RUNPOD_ENDPOINT_ID_PRO",
  "seedream-4.5-turbo": "RUNPOD_ENDPOINT_ID_TURBO",
  // NSFW (ComfyUI worker)
  "flux1-dev-nsfw": "RUNPOD_ENDPOINT_ID_FLUX_NSFW",
};

// モデルごとのデフォルトパラメータ
const MODEL_PARAMS: Record<string, { num_inference_steps: number; guidance_scale: number }> = {
  "seedream-4.5":       { num_inference_steps: 30, guidance_scale: 7.5 },
  "seedream-4.5-pro":   { num_inference_steps: 40, guidance_scale: 7.5 },
  "seedream-4.5-turbo": { num_inference_steps: 20, guidance_scale: 7.0 },
  "flux1-dev-nsfw":     { num_inference_steps: 28, guidance_scale: 3.5 },
};

// ComfyUI形式のワークフローJSONを生成
// eardori/comfyui-flux-uncensored:v1 に対応
//   - checkpoint: flux1-dev-fp8.safetensors
//   - LoRA: Flux-Uncensored-V2.safetensors (strength 0.85)
function buildFluxComfyWorkflow(
  prompt: string,
  width: number,
  height: number,
  steps: number,
  // guidance は Flux では BasicGuider 側で不要（CFG非依存）
  _guidance: number
) {
  const seed = Math.floor(Math.random() * 1e15);
  return {
    // 1. モデルロード (FP8チェックポイント)
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "flux1-dev-fp8.safetensors" },
    },
    // 2. LoRAロード (Flux-Uncensored-V2, strength=0.85)
    "2": {
      class_type: "LoraLoader",
      inputs: {
        model: ["1", 0],
        clip: ["1", 1],
        lora_name: "Flux-Uncensored-V2.safetensors",
        strength_model: 0.85,
        strength_clip: 0.85,
      },
    },
    // 3. プロンプトエンコード
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["2", 1], text: prompt },
    },
    // 4. 空のlatent生成
    "4": {
      class_type: "EmptySD3LatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    // 5. ノイズ
    "5": {
      class_type: "RandomNoise",
      inputs: { noise_seed: seed },
    },
    // 6. Guider (CFG不要なFlux用BasicGuider)
    "6": {
      class_type: "BasicGuider",
      inputs: { model: ["2", 0], conditioning: ["3", 0] },
    },
    // 7. サンプラー選択
    "7": {
      class_type: "KSamplerSelect",
      inputs: { sampler_name: "euler" },
    },
    // 8. スケジューラー
    "8": {
      class_type: "BasicScheduler",
      inputs: {
        model: ["2", 0],
        scheduler: "simple",
        steps,
        denoise: 1.0,
      },
    },
    // 9. サンプリング実行
    "9": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["5", 0],
        guider: ["6", 0],
        sampler: ["7", 0],
        sigmas: ["8", 0],
        latent_image: ["4", 0],
      },
    },
    // 10. VAEデコード
    "10": {
      class_type: "VAEDecode",
      inputs: { samples: ["9", 0], vae: ["1", 2] },
    },
    // 11. 画像保存
    "11": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "flux_nsfw", images: ["10", 0] },
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RUNPOD_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "RUNPOD_API_KEY が設定されていません。" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const aspectRatio = formData.get("aspectRatio") as string;
    const model = (formData.get("model") as string) || "seedream-4.5";

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "プロンプトを入力してください。" },
        { status: 400 }
      );
    }

    // モデルに対応するエンドポイントIDを取得（未設定の場合はデフォルトにフォールバック）
    const endpointEnvKey = MODEL_ENDPOINT_MAP[model] ?? "RUNPOD_ENDPOINT_ID";
    const endpointId = process.env[endpointEnvKey] || process.env.RUNPOD_ENDPOINT_ID;

    if (!apiKey || !endpointId) {
      return NextResponse.json(
        { error: "RUNPOD_API_KEY または RUNPOD_ENDPOINT_ID が設定されていません。" },
        { status: 500 }
      );
    }

    const size = ASPECT_RATIO_SIZES[aspectRatio] || ASPECT_RATIO_SIZES["1:1"];
    const params = MODEL_PARAMS[model] ?? MODEL_PARAMS["seedream-4.5"];

    const isComfyModel = model === "flux1-dev-nsfw";

    const requestBody = isComfyModel
      ? {
          input: {
            workflow: buildFluxComfyWorkflow(
              prompt.trim(),
              size.width,
              size.height,
              params.num_inference_steps,
              params.guidance_scale
            ),
          },
        }
      : {
          input: {
            prompt: prompt.trim(),
            width: size.width,
            height: size.height,
            num_inference_steps: params.num_inference_steps,
            guidance_scale: params.guidance_scale,
          },
        };

    // RunPod Serverless API — kick off a job
    const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `RunPod API error: ${res.status}`);
    }

    return NextResponse.json({ id: data.id, status: data.status });
  } catch (err: unknown) {
    console.error("Generation error:", err);
    const message =
      err instanceof Error ? err.message : "画像生成の開始に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
