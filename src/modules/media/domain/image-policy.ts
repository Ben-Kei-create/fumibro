import { z } from "zod";

export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

export const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof allowedImageMimeTypes)[number];

export const imageUploadRequestSchema = z.object({
  altText: z.string().trim().max(500).optional().default(""),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(allowedImageMimeTypes),
  sizeBytes: z.number().int().min(1).max(MAX_IMAGE_UPLOAD_BYTES),
});

export const completeImageUploadSchema = z.object({
  assetId: z.string().uuid(),
});

const mimeTypeExtensions: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForImageMimeType(
  mimeType: AllowedImageMimeType,
): string {
  return mimeTypeExtensions[mimeType];
}

export function sanitizeOriginalFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).at(-1) ?? "image";
  const sanitized = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim();

  return sanitized.slice(0, 255) || "image";
}

export function detectImageMimeType(
  bytes: Uint8Array,
): AllowedImageMimeType | undefined {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return undefined;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}
