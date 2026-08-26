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
  const { error } = await supabase.rpc("admin_create_quick_post", {
    p_body_markdown: parsed.data.body,
    p_post_category_id: parsed.data.categoryId,
    p_project_id: parsed.data.projectId,
    p_publish: parsed.data.publishMode === "published",
    p_slug: makeQuickPostSlug(),
    p_tag_ids: parsed.data.tagIds,
    p_title: parsed.data.title || null,
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
