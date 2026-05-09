// 画像ファイルからピクセル寸法を取得
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const result = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像サイズの取得に失敗しました"));
    };
    img.src = url;
  });
}

// 入力寸法から BytePlus Seedream に渡せる "WxH" 文字列を生成
// 制約: 総ピクセル 3.6M〜16.7M、アスペクト比 1/16〜16
const BYTEPLUS_TARGET_PIXELS = 4_000_000; // 約 2048x2048 相当
const BYTEPLUS_MIN_PIXELS = 3_600_000;
const BYTEPLUS_MAX_PIXELS = 16_700_000;
const BYTEPLUS_MAX_RATIO = 16;

export function dimensionsToBytePlusSize(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "2048x2048";

  // アスペクト比をクランプ (1/16 〜 16)
  let aspect = width / height;
  if (aspect > BYTEPLUS_MAX_RATIO) aspect = BYTEPLUS_MAX_RATIO;
  if (aspect < 1 / BYTEPLUS_MAX_RATIO) aspect = 1 / BYTEPLUS_MAX_RATIO;

  // 目標総ピクセル数になるように w, h をスケール
  // w * h = TARGET, w / h = aspect  ⇒  w = sqrt(TARGET * aspect)
  let w = Math.round(Math.sqrt(BYTEPLUS_TARGET_PIXELS * aspect));
  let h = Math.round(Math.sqrt(BYTEPLUS_TARGET_PIXELS / aspect));

  // 偶数化 (生成モデルが多くは2の倍数を要求するため、安全策)
  w = w - (w % 2);
  h = h - (h % 2);

  // 念の為クランプ
  const total = w * h;
  if (total < BYTEPLUS_MIN_PIXELS || total > BYTEPLUS_MAX_PIXELS) {
    const scale = Math.sqrt(BYTEPLUS_TARGET_PIXELS / total);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    w = w - (w % 2);
    h = h - (h % 2);
  }

  return `${w}x${h}`;
}

// File から直接 BytePlus 用 size 文字列を取得するヘルパ
export async function fileToBytePlusSize(file: File): Promise<string> {
  const { width, height } = await getImageDimensions(file);
  return dimensionsToBytePlusSize(width, height);
}
