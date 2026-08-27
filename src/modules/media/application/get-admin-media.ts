import "server-only";

import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/modules/auth/application/require-admin";

export type AdminMediaItemDto = {
  altText: string | null;
  createdAt: string;
  errorMessage: string | null;
  height: number | null;
  id: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  state: "uploaded" | "processing" | "ready" | "failed";
  thumbnailUrl?: string;
  width: number | null;
};

export async function getAdminMedia(): Promise<{
  hasError: boolean;
  items: AdminMediaItemDto[];
}> {
  await requireAdmin({ nextPath: "/admin/media" });
  const service = createServiceSupabaseClient();
  const { data: assets, error } = await service
    .from("assets")
    .select(
      "id,state,original_filename,mime_type,size_bytes,width,height,alt_text,error_message,created_at",
    )
    .eq("kind", "image")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !assets) {
    return { hasError: true, items: [] };
  }

  const assetIds = assets.map((asset) => asset.id);
  const { data: variants, error: variantError } =
    assetIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("asset_variants")
          .select("asset_id,object_path")
          .in("asset_id", assetIds)
          .eq("variant_role", "thumbnail");

  return {
    hasError: Boolean(variantError),
    items: assets.map((asset) => {
      const thumbnailPath = variants?.find(
        (variant) => variant.asset_id === asset.id,
      )?.object_path;

      return {
        altText: asset.alt_text,
        createdAt: asset.created_at,
        errorMessage: asset.error_message,
        height: asset.height,
        id: asset.id,
        mimeType: asset.mime_type,
        originalFilename: asset.original_filename,
        sizeBytes: asset.size_bytes,
        state: asset.state,
        thumbnailUrl: thumbnailPath
          ? service.storage.from("public-media").getPublicUrl(thumbnailPath)
              .data.publicUrl
          : undefined,
        width: asset.width,
      };
    }),
  };
}
