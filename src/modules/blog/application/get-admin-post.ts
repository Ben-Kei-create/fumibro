import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";
import type {
  AdminPostEditorDto,
  AdminPostListItemDto,
} from "@/modules/blog/application/admin-post-dto";

export async function getAdminPost(
  contentId: string,
): Promise<AdminPostEditorDto | null> {
  const { supabase } = await requireAdmin({
    nextPath: `/admin/posts/${contentId}/edit`,
  });
  const [contentResult, postResult, tagResult] = await Promise.all([
    supabase
      .from("content_items")
      .select(
        "id,project_id,slug,title,excerpt,status,posted_at,publish_at,lock_version,deleted_at",
      )
      .eq("id", contentId)
      .eq("kind", "post")
      .maybeSingle(),
    supabase
      .from("posts")
      .select(
        "content_item_id,body_markdown,post_category_id,location_id,image_asset_id,external_url,is_spoiler,watermark_enabled",
      )
      .eq("content_item_id", contentId)
      .maybeSingle(),
    supabase
      .from("content_tags")
      .select("tag_id")
      .eq("content_item_id", contentId),
  ]);

  if (
    contentResult.error ||
    postResult.error ||
    tagResult.error ||
    !contentResult.data ||
    !postResult.data ||
    contentResult.data.deleted_at
  ) {
    return null;
  }

  let image: AdminPostEditorDto["image"];

  if (postResult.data.image_asset_id) {
    const [assetResult, variantResult] = await Promise.all([
      supabase
        .from("assets")
        .select("id,alt_text")
        .eq("id", postResult.data.image_asset_id)
        .maybeSingle(),
      supabase
        .from("asset_variants")
        .select("variant_role,object_path")
        .eq("asset_id", postResult.data.image_asset_id)
        .in("variant_role", ["display", "thumbnail"]),
    ]);
    const displayPath = variantResult.data?.find(
      (variant) => variant.variant_role === "display",
    )?.object_path;
    const thumbnailPath = variantResult.data?.find(
      (variant) => variant.variant_role === "thumbnail",
    )?.object_path;

    if (assetResult.data && displayPath && thumbnailPath) {
      image = {
        altText: assetResult.data.alt_text,
        assetId: assetResult.data.id,
        displayUrl: supabase.storage
          .from("public-media")
          .getPublicUrl(displayPath).data.publicUrl,
        thumbnailUrl: supabase.storage
          .from("public-media")
          .getPublicUrl(thumbnailPath).data.publicUrl,
      };
    }
  }

  return {
    body: postResult.data.body_markdown,
    categoryId: postResult.data.post_category_id,
    contentId: contentResult.data.id,
    excerpt: contentResult.data.excerpt ?? "",
    externalUrl: postResult.data.external_url ?? "",
    image,
    isSpoiler: postResult.data.is_spoiler,
    locationId: postResult.data.location_id,
    lockVersion: contentResult.data.lock_version,
    postedAt: contentResult.data.posted_at,
    projectId: contentResult.data.project_id,
    publishAt: contentResult.data.publish_at ?? "",
    slug: contentResult.data.slug,
    status: contentResult.data.status,
    tagIds: (tagResult.data ?? []).map((tag) => tag.tag_id),
    title: contentResult.data.title ?? "",
    watermarkEnabled: postResult.data.watermark_enabled,
  };
}

export async function getAdminPosts(
  options: {
    trash?: boolean;
  } = {},
): Promise<{ hasError: boolean; posts: AdminPostListItemDto[] }> {
  const { supabase } = await requireAdmin({ nextPath: "/admin/posts" });
  let query = supabase
    .from("content_items")
    .select(
      "id,slug,title,status,publish_at,lock_version,updated_at,deleted_at",
    )
    .eq("kind", "post")
    .order("updated_at", { ascending: false })
    .limit(100);

  query = options.trash
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);

  const result = await query;

  return {
    hasError: Boolean(result.error),
    posts: (result.data ?? []).map((post) => ({
      contentId: post.id,
      deletedAt: post.deleted_at,
      lockVersion: post.lock_version,
      publishAt: post.publish_at,
      slug: post.slug,
      status: post.status,
      title: post.title,
      updatedAt: post.updated_at,
    })),
  };
}
