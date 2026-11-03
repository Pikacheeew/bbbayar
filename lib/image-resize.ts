const LANDSCAPE_ASPECT = 4 / 3;

export async function resizeImage(file: File, maxWidth = 1200, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let cropW = bitmap.width;
  let cropH = Math.round(bitmap.width / LANDSCAPE_ASPECT);
  if (cropH > bitmap.height) {
    cropH = bitmap.height;
    cropW = Math.round(bitmap.height * LANDSCAPE_ASPECT);
  }
  const sx = Math.round((bitmap.width - cropW) / 2);
  const sy = Math.round((bitmap.height - cropH) / 2);
  const outW = Math.min(cropW, maxWidth);
  const outH = Math.round(outW / LANDSCAPE_ASPECT);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image resize failed"))),
      "image/jpeg",
      quality
    );
  });
}
