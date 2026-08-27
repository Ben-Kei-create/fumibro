import "server-only";

import { requireAdminApi } from "@/modules/auth/application/require-admin-api";
import { LibraryFileError } from "@/modules/library-files/application/errors";
import {
  extensionForLibraryMimeType,
  libraryUploadRequestSchema,
  sanitizeLibraryFilename,
} from "@/modules/library-files/domain/download-policy";

export async function initializeLibraryUpload(input: unknown) {
  const parsed = libraryUploadRequestSchema.safeParse(input);
  if (!parsed.success)
    throw new LibraryFileError(
      "invalid_upload_request",
      400,
      "PDF・ZIPを100MB以下で指定してください。",
    );

  const { supabase, userId } = await requireAdminApi();
  const library = await supabase
    .from("library_items")
    .select("content_item_id")
    .eq("content_item_id", parsed.data.libraryItemId)
    .maybeSingle();
  if (library.error || !library.data)
    throw new LibraryFileError(
      "library_item_not_found",
      404,
      "Library項目が見つかりません。",
    );

  const assetId = crypto.randomUUID();
  const extension = extensionForLibraryMimeType(parsed.data.mimeType);
  const objectPath = `library/${parsed.data.libraryItemId}/${assetId}/download.${extension}`;
  const insertion = await supabase.from("assets").insert({
    created_by: userId,
    id: assetId,
    kind: extension === "pdf" ? "document" : "archive",
    metadata: {
      upload: {
        declared_mime_type: parsed.data.mimeType,
        declared_size_bytes: parsed.data.sizeBytes,
        object_path: objectPath,
      },
    },
    mime_type: parsed.data.mimeType,
    original_filename: sanitizeLibraryFilename(parsed.data.filename),
    size_bytes: parsed.data.sizeBytes,
    state: "uploaded",
    visibility: "private",
  });
  if (insertion.error)
    throw new LibraryFileError(
      "asset_create_failed",
      500,
      "ファイル登録を開始できませんでした。",
    );

  const signed = await supabase.storage
    .from("private-downloads")
    .createSignedUploadUrl(objectPath, { upsert: false });
  if (signed.error || !signed.data) {
    await supabase
      .from("assets")
      .update({ error_message: "Upload reservation failed.", state: "failed" })
      .eq("id", assetId);
    throw new LibraryFileError(
      "upload_reservation_failed",
      502,
      "アップロードを準備できませんでした。",
    );
  }
  return {
    assetId,
    bucket: "private-downloads" as const,
    mimeType: parsed.data.mimeType,
    path: signed.data.path,
    token: signed.data.token,
  };
}
