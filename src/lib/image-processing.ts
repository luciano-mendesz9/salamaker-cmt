import sharp from "sharp";

export const MAX_ASSET_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ASSET_DIMENSION = 4_096;

export async function convertAssetImage(input: Buffer, width: number, height: number) {
  if (input.length < 1 || input.length > MAX_ASSET_UPLOAD_BYTES) throw new Error("INVALID_FILE_SIZE");
  const image = sharp(input, { animated: false, limitInputPixels: MAX_ASSET_DIMENSION * MAX_ASSET_DIMENSION });
  let metadata;
  try { metadata = await image.metadata(); } catch { throw new Error("INVALID_IMAGE_FORMAT"); }
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("INVALID_IMAGE_FORMAT");
  if ((metadata.pages ?? 1) > 1) throw new Error("ANIMATED_IMAGE");
  if (!metadata.width || !metadata.height || metadata.width > MAX_ASSET_DIMENSION || metadata.height > MAX_ASSET_DIMENSION) throw new Error("INVALID_IMAGE_DIMENSIONS");
  return image.rotate().resize(width, height, { fit: "cover", position: "centre" }).webp({ quality: 85 }).toBuffer();
}
