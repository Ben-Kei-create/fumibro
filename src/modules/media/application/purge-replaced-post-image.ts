import "server-only";

import { z } from "zod";

import { createServiceSupabaseClient } from "@/lib/supabase/service";

const purgeManifestSchema = z.array(
  z.object({
    bucket_id: z.enum([
      "private-originals",
      "public-media",
      "private-downloads",
    ]),
    object_path: z.string().min(1).max(900),
  }),
);

type PurgeReplacedPostImageInput = {
  actorUserId: string;
  assetId: string;
  contentItemId: string;
};

export async function purgeReplacedPostImage({
  actorUserId,
  assetId,
  contentItemId,
}: PurgeReplacedPostImageInput): Promise<void> {
  const service = createServiceSupabaseClient();
  const { data, error } = await service.rpc(
    "service_prepare_replaced_post_image_purge",
    {
      p_actor_user_id: actorUserId,
      p_asset_id: assetId,
      p_content_item_id: contentItemId,
    },
  );
  const manifest = purgeManifestSchema.safeParse(data);

  if (error || !manifest.success) {
    throw new Error("replaced_post_image_prepare_failed");
  }

  try {
    for (const bucket of [
      "private-originals",
      "public-media",
      "private-downloads",
    ] as const) {
      const paths = manifest.data
        .filter((entry) => entry.bucket_id === bucket)
        .map((entry) => entry.object_path);

      if (paths.length === 0) continue;

      const { error: storageError } = await service.storage
        .from(bucket)
        .remove(paths);

      if (storageError) {
        throw new Error(`replaced_post_image_storage_failed:${bucket}`);
      }
    }
  } catch (error) {
    await service.rpc("service_fail_replaced_post_image_purge", {
      p_asset_id: assetId,
      p_error:
        error instanceof Error ? error.message : "Storage deletion failed",
    });
    throw error;
  }

  const { error: completionError } = await service.rpc(
    "service_complete_replaced_post_image_purge",
    {
      p_actor_user_id: actorUserId,
      p_asset_id: assetId,
      p_content_item_id: contentItemId,
    },
  );

  if (completionError) {
    await service.rpc("service_fail_replaced_post_image_purge", {
      p_asset_id: assetId,
      p_error: "Database completion failed after Storage deletion",
    });
    throw new Error("replaced_post_image_completion_failed");
  }
}
