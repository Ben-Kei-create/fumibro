import "server-only";

import { requireAdminApi } from "@/modules/auth/application/require-admin-api";
import { MediaApplicationError } from "@/modules/media/application/errors";
import {
  extensionForImageMimeType,
  imageUploadRequestSchema,
  sanitizeOriginalFilename,
} from "@/modules/media/domain/image-policy";

export type ImageUploadReservation = {
  assetId: string;
  bucket: "private-originals";
  mimeType: string;
  path: string;
  token: string;
};

export async function initializeImageUpload(
  input: unknown,
): Promise<ImageUploadReservation> {
  const parsed = imageUploadRequestSchema.safeParse(input);

  if (!parsed.success) {
    throw new MediaApplicationError(
      "invalid_upload_request",
      400,
      "画像はJPEG・PNG・WebP、20MB以下で指定してください。",
    );
  }

  const { supabase, userId } = await requireAdminApi();
  const assetId = crypto.randomUUID();
  const extension = extensionForImageMimeType(parsed.data.mimeType);
  const objectPath = `images/${assetId}/original.${extension}`;
  const filename = sanitizeOriginalFilename(parsed.data.filename);
  const { error: insertError } = await supabase.from("assets").insert({
    alt_text: parsed.data.altText || null,
    created_by: userId,
    id: assetId,
    kind: "image",
    metadata: {
      upload: {
        declared_mime_type: parsed.data.mimeType,
        declared_size_bytes: parsed.data.sizeBytes,
        object_path: objectPath,
      },
    },
    mime_type: parsed.data.mimeType,
    original_filename: filename,
    size_bytes: parsed.data.sizeBytes,
    state: "uploaded",
    visibility: "private",
  });

  if (insertError) {
    throw new MediaApplicationError(
      "asset_create_failed",
      500,
      "画像の登録を開始できませんでした。",
    );
  }

  const { data: signedUpload, error: signedUploadError } =
    await supabase.storage
      .from("private-originals")
      .createSignedUploadUrl(objectPath, { upsert: false });

  if (signedUploadError || !signedUpload) {
    await supabase
      .from("assets")
      .update({
        error_message: "Could not create a private upload reservation.",
        state: "failed",
      })
      .eq("id", assetId);

    throw new MediaApplicationError(
      "upload_reservation_failed",
      502,
      "画像アップロードを準備できませんでした。",
    );
  }

  return {
    assetId,
    bucket: "private-originals",
    mimeType: parsed.data.mimeType,
    path: signedUpload.path,
    token: signedUpload.token,
  };
}
