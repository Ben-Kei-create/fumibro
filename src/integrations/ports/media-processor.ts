export type ProcessedImage = Readonly<{
  display: Uint8Array;
  thumbnail: Uint8Array;
  displayWidth: number;
  displayHeight: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  mimeType: "image/webp";
}>;

export type ImageProcessingOptions = Readonly<{
  watermarkEnabled: boolean;
  displayMaxWidth: number;
  thumbnailMaxWidth: number;
}>;

export interface MediaProcessor {
  processImage(
    source: Uint8Array,
    options: ImageProcessingOptions,
  ): Promise<ProcessedImage>;
}
