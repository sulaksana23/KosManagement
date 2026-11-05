import "server-only";
import { Buffer } from "node:buffer";
import { detectPrivateImageMime, MAX_PRIVATE_IMAGE_BYTES, type PrivateImageMime } from "@/lib/private-image-validation";

export { MAX_PRIVATE_IMAGE_BYTES };

export type PrivateImage = {
  fileName: string;
  mimeType: PrivateImageMime;
  sizeBytes: number;
  data: Buffer;
};

export async function readPrivateImage(form: FormData, fieldName: string): Promise<PrivateImage | null> {
  const value = form.get(fieldName);
  if (!value || typeof value === "string" || value.size === 0) return null;
  if (value.size > MAX_PRIVATE_IMAGE_BYTES) throw new Error("PRIVATE_FILE_TOO_LARGE");
  const bytes = Buffer.from(await value.arrayBuffer());
  const mimeType = detectPrivateImageMime(bytes);
  if (!mimeType || value.type !== mimeType) throw new Error("PRIVATE_FILE_INVALID");
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  return { fileName: `lampiran.${extension}`, mimeType, sizeBytes: bytes.byteLength, data: bytes };
}
