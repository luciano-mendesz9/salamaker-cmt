import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { convertAssetImage, MAX_ASSET_UPLOAD_BYTES } from "./image-processing";

test("valid JPEG is recoded to a metadata-free 3:4 WebP", async () => {
  const source = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#2563eb" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const output = await convertAssetImage(source, 900, 1200);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 900);
  assert.equal(metadata.height, 1200);
  assert.equal(metadata.exif, undefined);
});

test("corrupt, unsupported and oversized payloads are rejected", async () => {
  await assert.rejects(convertAssetImage(Buffer.from("not-an-image"), 512, 512), /INVALID_IMAGE_FORMAT/);
  const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).gif().toBuffer();
  await assert.rejects(convertAssetImage(gif, 512, 512), /INVALID_IMAGE_FORMAT/);
  await assert.rejects(convertAssetImage(Buffer.alloc(MAX_ASSET_UPLOAD_BYTES + 1), 512, 512), /INVALID_FILE_SIZE/);
});

test("image dimensions above 4096 are rejected", async () => {
  const wide = await sharp({ create: { width: 4097, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(convertAssetImage(wide, 512, 512), /INVALID_IMAGE_DIMENSIONS/);
});
