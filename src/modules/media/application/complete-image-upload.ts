import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireAdminApi } from "@/modules/auth/application/require-admin-api";
import { MediaApplicationError } from "@/modules/media/application/errors";
import {
  allowedImageMimeTypes,
  completeImageUploadSchema,
  ImageValidationError,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@/modules/media/domain/image-policy";
import { processUploadedImage } from "@/modules/media/infrastructure/sharp-image-processor";

const uploadMetadataSchema = z.object({
  upload: z.object({
    declared_mime_type: z.enum(allowedImageMimeTypes),
    declared_size_bytes: z
      .number()
      .int()
      .positive()
      .max(MAX_IMAGE_UPLOAD_BYTES),
    object_path: z.string().min(1).max(900),
  }),
});

type ReadyImage = {
  altText: string | null;
  assetId: string;
  displayUrl: string;
  thumbnailUrl: string;
};

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function getReadyImage(
  assetId: string,
  altText: string | null,
): Promise<ReadyImage> {
  const service = createServiceSupabaseClient();
  const { data: variants, error } = await service
    .from("asset_variants")
    .select("variant_role,object_path")
    .eq("asset_id", assetId)
    .in("variant_role", ["display", "thumbnail"]);

  if (error) {
    throw new MediaApplicationError(
      "variant_lookup_failed",
      500,
      "処理済み画像を確認できませんでした。",
    );
  }

  const displayPath = variants?.find(
    (variant) => variant.variant_role === "display",
  )?.object_path;
  const thumbnailPath = variants?.find(
    (variant) => variant.variant_role === "thumbnail",
  )?.object_path;

  if (!displayPath || !thumbnailPath) {
    throw new MediaApplicationError(
      "variants_incomplete",
      500,
      "処理済み画像が不完全です。",
    );
  }

  return {
    altText,
    assetId,
    displayUrl: service.storage.from("public-media").getPublicUrl(displayPath)
      .data.publicUrl,
    thumbnailUrl: service.storage
      .from("public-media")
      .getPublicUrl(thumbnailPath).data.publicUrl,
  };
}

export async function completeImageUpload(input: unknown): Promise<ReadyImage> {
  const parsed = completeImageUploadSchema.safeParse(input);

  if (!parsed.success) {
    throw new MediaApplicationError(
      "invalid_completion_request",
      400,
      "画像IDが正しくありません。",
    );
  }

  const { userId } = await requireAdminApi();
  const service = createServiceSupabaseClient();
  const { data: existing, error: lookupError } = await service
    .from("assets")
    .select("id,state,kind,created_by,alt_text,metadata,deleted_at")
    .eq("id", parsed.data.assetId)
    .maybeSingle();

  if (
    lookupError ||
    !existing ||
    existing.kind !== "image" ||
    existing.created_by !== userId ||
    existing.deleted_at
  ) {
    throw new MediaApplicationError(
      "asset_not_found",
      404,
      "処理対象の画像が見つかりません。",
    );
  }

  if (existing.state === "ready") {
    return getReadyImage(existing.id, existing.alt_text);
  }

  const uploadMetadata = uploadMetadataSchema.safeParse(existing.metadata);

  if (!uploadMetadata.success) {
    throw new MediaApplicationError(
      "upload_metadata_invalid",
      409,
      "画像アップロードの予約情報が不完全です。",
    );
  }

  const { data: claimed, error: claimError } = await service
    .from("assets")
    .update({ error_message: null, state: "processing" })
    .eq("id", existing.id)
    .eq("created_by", userId)
    .in("state", ["uploaded", "failed"])
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    throw new MediaApplicationError(
      "asset_processing_conflict",
      409,
      "この画像は現在処理中です。少し待ってから再読込してください。",
    );
  }

  const reservation = uploadMetadata.data.upload;
  const displayPath = `images/${existing.id}/display.webp`;
  const thumbnailPath = `images/${existing.id}/thumbnail.webp`;
  let shouldDeleteOriginal = false;

  try {
    const { data: originalBlob, error: downloadError } = await service.storage
      .from("private-originals")
      .download(reservation.object_path);

    if (downloadError || !originalBlob) {
      throw new MediaApplicationError(
        "original_missing",
        422,
        "アップロード済みの元画像を取得できませんでした。",
      );
    }

    if (
      originalBlob.size !== reservation.declared_size_bytes ||
      originalBlob.size > MAX_IMAGE_UPLOAD_BYTES
    ) {
      shouldDeleteOriginal = true;
      throw new ImageValidationError(
        "Uploaded byte size does not match the reservation.",
      );
    }

    const originalBuffer = Buffer.from(await originalBlob.arrayBuffer());
    const processed = await processUploadedImage(
      originalBuffer,
      reservation.declared_mime_type,
    );

    const displayUpload = await service.storage
      .from("public-media")
      .upload(displayPath, processed.display.buffer, {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: true,
      });

    if (displayUpload.error) {
      throw new MediaApplicationError(
        "display_upload_failed",
        502,
        "表示画像を保存できませんでした。",
      );
    }

    const thumbnailUpload = await service.storage
      .from("public-media")
      .upload(thumbnailPath, processed.thumbnail.buffer, {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: true,
      });

    if (thumbnailUpload.error) {
      throw new MediaApplicationError(
        "thumbnail_upload_failed",
        502,
        "サムネイルを保存できませんでした。",
      );
    }

    const { error: finalizeError } = await service.rpc(
      "service_finalize_processed_image",
      {
        p_asset_id: existing.id,
        p_display_checksum_sha256: sha256(processed.display.buffer),
        p_display_height: processed.display.height,
        p_display_path: displayPath,
        p_display_size_bytes: processed.display.buffer.length,
        p_display_width: processed.display.width,
        p_height: processed.height,
        p_original_checksum_sha256: sha256(originalBuffer),
        p_original_mime_type: processed.mimeType,
        p_original_path: reservation.object_path,
        p_original_size_bytes: originalBuffer.length,
        p_thumbnail_checksum_sha256: sha256(processed.thumbnail.buffer),
        p_thumbnail_height: processed.thumbnail.height,
        p_thumbnail_path: thumbnailPath,
        p_thumbnail_size_bytes: processed.thumbnail.buffer.length,
        p_thumbnail_width: processed.thumbnail.width,
        p_width: processed.width,
      },
    );

    if (finalizeError) {
      throw new MediaApplicationError(
        "image_finalize_failed",
        500,
        "画像処理結果を確定できませんでした。",
      );
    }

    return getReadyImage(existing.id, existing.alt_text);
  } catch (error) {
    await service.storage
      .from("public-media")
      .remove([displayPath, thumbnailPath]);

    if (error instanceof ImageValidationError || shouldDeleteOriginal) {
      shouldDeleteOriginal = true;
      await service.storage
        .from("private-originals")
        .remove([reservation.object_path]);
    }

    await service
      .from("assets")
      .update({
        error_message: shouldDeleteOriginal
          ? "Image validation failed."
          : "Image processing failed; retry is available.",
        state: "failed",
      })
      .eq("id", existing.id);

    if (error instanceof MediaApplicationError) {
      throw error;
    }

    throw new MediaApplicationError(
      "image_validation_failed",
      422,
      "画像を検証または処理できませんでした。JPEG・PNG・WebPの静止画を使用してください。",
    );
  }
}
