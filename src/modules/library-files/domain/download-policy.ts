import { z } from "zod";

export const MAX_LIBRARY_FILE_BYTES = 100 * 1024 * 1024;
export const allowedLibraryMimeTypes = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
] as const;

const safeDisplayName = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\u0000-\u001F\u007F]/u.test(value));
const safeVersionLabel = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((value) => !/[\u0000-\u001F\u007F]/u.test(value));

export const libraryUploadRequestSchema = z.object({
  displayName: safeDisplayName,
  displayOrder: z.number().int().min(-10_000).max(10_000),
  filename: z.string().trim().min(1).max(255),
  isPrimary: z.boolean(),
  libraryItemId: z.string().uuid(),
  mimeType: z.enum(allowedLibraryMimeTypes),
  sizeBytes: z.number().int().positive().max(MAX_LIBRARY_FILE_BYTES),
  versionLabel: safeVersionLabel,
});

export const completeLibraryUploadSchema = z.object({
  assetId: z.string().uuid(),
  displayName: safeDisplayName,
  displayOrder: z.number().int().min(-10_000).max(10_000),
  isPrimary: z.boolean(),
  libraryItemId: z.string().uuid(),
  versionLabel: safeVersionLabel,
});

export function sanitizeLibraryFilename(filename: string): string {
  const normalized = filename
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F/\\]/gu, "_");
  return normalized.slice(0, 255) || "download";
}

export function extensionForLibraryMimeType(mimeType: string): "pdf" | "zip" {
  return mimeType === "application/pdf" ? "pdf" : "zip";
}

export function hasExpectedLibraryMagic(
  buffer: Buffer,
  mimeType: string,
): boolean {
  if (mimeType === "application/pdf")
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (buffer.length < 4) return false;
  const signature = buffer.subarray(0, 4).toString("hex");
  return ["504b0304", "504b0506", "504b0708"].includes(signature);
}
