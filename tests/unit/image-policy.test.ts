import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  detectImageMimeType,
  ImageValidationError,
  sanitizeOriginalFilename,
} from "@/modules/media/domain/image-policy";
import { processUploadedImage } from "@/modules/media/infrastructure/sharp-image-processor";

describe("image upload policy", () => {
  it("detects allowlisted magic bytes", () => {
    expect(detectImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg",
    );
    expect(
      detectImageMimeType(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(detectImageMimeType(new TextEncoder().encode("not-an-image"))).toBe(
      undefined,
    );
  });

  it("drops path and control characters from the stored original filename", () => {
    expect(sanitizeOriginalFilename("../folder/\u0000cat.png")).toBe("cat.png");
  });

  it("validates and generates metadata-free WebP display variants", async () => {
    const jpeg = await sharp({
      create: {
        background: { b: 30, g: 20, r: 10 },
        channels: 3,
        height: 50,
        width: 100,
      },
    })
      .jpeg()
      .toBuffer();
    const processed = await processUploadedImage(jpeg, "image/jpeg");
    const displayMetadata = await sharp(processed.display.buffer).metadata();

    expect(processed).toMatchObject({
      height: 50,
      mimeType: "image/jpeg",
      width: 100,
    });
    expect(displayMetadata).toMatchObject({
      format: "webp",
      height: 50,
      width: 100,
    });
  });

  it("rejects a declared MIME mismatch", async () => {
    const png = await sharp({
      create: {
        background: { alpha: 1, b: 0, g: 0, r: 0 },
        channels: 4,
        height: 1,
        width: 1,
      },
    })
      .png()
      .toBuffer();

    await expect(
      processUploadedImage(png, "image/jpeg"),
    ).rejects.toBeInstanceOf(ImageValidationError);
  });
});
