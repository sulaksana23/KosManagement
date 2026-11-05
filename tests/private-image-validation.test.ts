import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
import { detectPrivateImageMime, MAX_PRIVATE_IMAGE_BYTES } from "../src/lib/private-image-validation";

test("lampiran hanya menerima signature JPEG, PNG, dan WebP", () => {
  assert.equal(detectPrivateImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectPrivateImageMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(detectPrivateImageMime(Buffer.from("RIFF0000WEBP")), "image/webp");
  assert.equal(detectPrivateImageMime(Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")), null);
  assert.equal(detectPrivateImageMime(Buffer.from("not an image")), null);
  assert.equal(MAX_PRIVATE_IMAGE_BYTES, 1_500_000);
});
