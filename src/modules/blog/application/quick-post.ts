"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/modules/auth/application/require-admin";
import {
  makeQuickPostSlug,
  quickPostSchema,
} from "@/modules/blog/domain/quick-post";

export async function createQuickPostAction(formData: FormData) {
  const title = formData.get("title");
  const parsed = quickPostSchema.safeParse({
    body: formData.get("body"),
    categoryId: formData.get("categoryId") ?? "",
    imageAssetId: formData.get("imageAssetId") ?? "",
    projectId: formData.get("projectId") ?? "",
    publishMode: formData.get("publishMode"),
    tagIds: formData
      .getAll("tagIds")
      .filter((value): value is string => typeof value === "string"),
    title: typeof title === "string" ? title : undefined,
  });

  if (!parsed.success) {
    redirect("/admin/quick?error=invalid");
  }

  const { supabase } = await requireAdmin({ nextPath: "/admin/quick" });
  const now = new Date().toISOString();
  const { error } = await supabase.rpc("admin_save_post", {
    p_body_markdown: parsed.data.body,
    p_change_reason: "Quick投稿",
    p_content_item_id: null,
    p_expected_lock_version: null,
    p_excerpt: null,
    p_external_url: null,
    p_image_asset_id: parsed.data.imageAssetId,
    p_is_spoiler: false,
    p_location_id: null,
    p_post_category_id: parsed.data.categoryId,
    p_posted_at: now,
    p_project_id: parsed.data.projectId,
    p_publish_at: parsed.data.publishMode === "published" ? now : null,
    p_slug: makeQuickPostSlug(),
    p_status: parsed.data.publishMode,
    p_tag_ids: parsed.data.tagIds,
    p_title: parsed.data.title || null,
    p_watermark_enabled: false,
  });

  if (error) {
    redirect("/admin/quick?error=save");
  }

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/quick");
  redirect(`/admin/quick?saved=${parsed.data.publishMode}`);
}
