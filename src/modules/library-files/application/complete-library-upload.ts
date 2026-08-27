import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireAdminApi } from "@/modules/auth/application/require-admin-api";
import { LibraryFileError } from "@/modules/library-files/application/errors";
import {
  allowedLibraryMimeTypes,
  completeLibraryUploadSchema,
  hasExpectedLibraryMagic,
  MAX_LIBRARY_FILE_BYTES,
} from "@/modules/library-files/domain/download-policy";

const metadataSchema = z.object({
  upload: z.object({
    declared_mime_type: z.enum(allowedLibraryMimeTypes),
    declared_size_bytes: z
      .number()
      .int()
      .positive()
      .max(MAX_LIBRARY_FILE_BYTES),
    object_path: z.string().min(1).max(900),
  }),
});

export async function completeLibraryUpload(input: unknown) {
  const parsed = completeLibraryUploadSchema.safeParse(input);
  if (!parsed.success)
    throw new LibraryFileError(
      "invalid_completion_request",
      400,
      "ファイル情報が正しくありません。",
    );

  const { supabase, userId } = await requireAdminApi();
  const service = createServiceSupabaseClient();
  const existing = await service
    .from("assets")
    .select("id,state,kind,created_by,mime_type,size_bytes,metadata,deleted_at")
    .eq("id", parsed.data.assetId)
    .maybeSingle();
  if (
    existing.error ||
    !existing.data ||
    !["document", "archive"].includes(existing.data.kind) ||
    existing.data.created_by !== userId ||
    existing.data.deleted_at
  )
    throw new LibraryFileError(
      "asset_not_found",
      404,
      "対象ファイルが見つかりません。",
    );

  const metadata = metadataSchema.safeParse(existing.data.metadata);
  if (!metadata.success)
    throw new LibraryFileError(
      "upload_metadata_invalid",
      409,
      "アップロード予約が不完全です。",
    );
  const upload = metadata.data.upload;
  let ready = existing.data.state === "ready";

  if (!ready) {
    const claimed = await service
      .from("assets")
      .update({ error_message: null, state: "processing" })
      .eq("id", existing.data.id)
      .eq("created_by", userId)
      .in("state", ["uploaded", "failed"])
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (claimed.error || !claimed.data)
      throw new LibraryFileError(
        "asset_processing_conflict",
        409,
        "ファイルは現在処理中です。",
      );

    try {
      const downloaded = await service.storage
        .from("private-downloads")
        .download(upload.object_path);
      if (downloaded.error || !downloaded.data)
        throw new LibraryFileError(
          "uploaded_file_missing",
          422,
          "アップロード済みファイルがありません。",
        );
      if (
        downloaded.data.size !== upload.declared_size_bytes ||
        downloaded.data.size > MAX_LIBRARY_FILE_BYTES
      )
        throw new LibraryFileError(
          "file_size_mismatch",
          422,
          "ファイルサイズが予約と一致しません。",
        );
      const buffer = Buffer.from(await downloaded.data.arrayBuffer());
      if (!hasExpectedLibraryMagic(buffer, upload.declared_mime_type))
        throw new LibraryFileError(
          "file_signature_invalid",
          422,
          "PDFまたはZIPの内容を確認できませんでした。",
        );
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const finalized = await service.rpc("service_finalize_download_asset", {
        p_asset_id: existing.data.id,
        p_checksum_sha256: checksum,
        p_mime_type: upload.declared_mime_type,
        p_object_path: upload.object_path,
        p_size_bytes: buffer.length,
      });
      if (finalized.error)
        throw new LibraryFileError(
          "asset_finalize_failed",
          500,
          "ファイルを確定できませんでした。",
        );
      ready = true;
    } catch (error) {
      await service
        .from("assets")
        .update({
          error_message: "Download validation failed.",
          state: "failed",
        })
        .eq("id", existing.data.id);
      if (error instanceof LibraryFileError && error.status === 422)
        await service.storage
          .from("private-downloads")
          .remove([upload.object_path]);
      throw error;
    }
  }

  if (!ready)
    throw new LibraryFileError(
      "asset_not_ready",
      409,
      "ファイルを利用できません。",
    );
  const alreadyAttached = await supabase
    .from("library_files")
    .select("id,library_item_id,display_name,version_label,is_primary")
    .eq("asset_id", existing.data.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (alreadyAttached.data) {
    if (alreadyAttached.data.library_item_id !== parsed.data.libraryItemId)
      throw new LibraryFileError(
        "asset_already_attached",
        409,
        "このファイルは別のLibrary項目に添付済みです。",
      );
    return alreadyAttached.data;
  }

  const attached = await supabase.rpc("admin_add_library_file", {
    p_asset_id: existing.data.id,
    p_display_name: parsed.data.displayName,
    p_display_order: parsed.data.displayOrder,
    p_is_primary: parsed.data.isPrimary,
    p_library_item_id: parsed.data.libraryItemId,
    p_version_label: parsed.data.versionLabel,
  });
  if (attached.error)
    throw new LibraryFileError(
      "library_file_attach_failed",
      500,
      "Libraryへファイルを添付できませんでした。",
    );
  return {
    display_name: parsed.data.displayName,
    id: attached.data,
    is_primary: parsed.data.isPrimary,
    library_item_id: parsed.data.libraryItemId,
    version_label: parsed.data.versionLabel,
  };
}
