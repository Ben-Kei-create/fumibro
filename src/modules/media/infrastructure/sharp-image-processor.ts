import "server-only";

import sharp from "sharp";

import {
  detectImageMimeType,
  ImageValidationError,
  MAX_IMAGE_PIXELS,
  type AllowedImageMimeType,
} from "@/modules/media/domain/image-policy";

type ProcessedVariant = {
  buffer: Buffer;
  height: number;
  width: number;
};

export type ProcessedImage = {
  display: ProcessedVariant;
  height: number;
  mimeType: AllowedImageMimeType;
  thumbnail: ProcessedVariant;
  width: number;
};

function orientedDimensions(
  width: number,
  height: number,
  orientation: number | undefined,
) {
  return orientation && orientation >= 5 && orientation <= 8
    ? { height: width, width: height }
    : { height, width };
}

async function makeVariant(
  input: Buffer,
  maxDimension: number,
  quality: number,
): Promise<ProcessedVariant> {
  const { data, info } = await sharp(input, {
    animated: false,
    failOn: "warning",
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .resize({
      fit: "inside",
      height: maxDimension,
      width: maxDimension,
      withoutEnlargement: true,
    })
    .webp({ effort: 4, quality })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, height: info.height, width: info.width };
}

export async function processUploadedImage(
  input: Buffer,
  declaredMimeType: AllowedImageMimeType,
): Promise<ProcessedImage> {
  const detectedMimeType = detectImageMimeType(input);

  if (!detectedMimeType || detectedMimeType !== declaredMimeType) {
    throw new ImageValidationError(
      "Image magic bytes do not match the declared type.",
    );
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

  try {
    metadata = await sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new ImageValidationError("The uploaded image cannot be decoded.");
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageValidationError(
      "The uploaded image has no valid dimensions.",
    );
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new ImageValidationError(
      "Animated images are not supported in Phase 1.",
    );
  }

  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new ImageValidationError(
      "The uploaded image exceeds the pixel limit.",
    );
  }

  const dimensions = orientedDimensions(
    metadata.width,
    metadata.height,
    metadata.orientation,
  );

  try {
    const [display, thumbnail] = await Promise.all([
      makeVariant(input, 1920, 82),
      makeVariant(input, 640, 76),
    ]);

    return {
      display,
      height: dimensions.height,
      mimeType: detectedMimeType,
      thumbnail,
      width: dimensions.width,
    };
  } catch {
    throw new ImageValidationError(
      "The uploaded image could not be processed.",
    );
  }
}
