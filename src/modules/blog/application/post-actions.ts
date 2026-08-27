"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/modules/auth/application/require-admin";
import { postEditorSchema } from "@/modules/blog/domain/post-editor";

export type PostEditorActionState = {
  message?: string;
  status: "idle" | "error";
};

const contentMutationSchema = z.object({
  contentId: z.string().uuid(),
  expectedLockVersion: z.coerce.number().int().positive(),
});

const purgeManifestSchema = z.array(
  z.object({
    asset_id: z.string().uuid(),
    bucket_id: z.enum([
      "private-originals",
      "public-media",
      "private-downloads",
    ]),
    object_path: z.string().min(1).max(900),
  }),
);

function revalidateContentPaths(contentId?: string) {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/admin/trash");

  if (contentId) {
    revalidatePath(`/admin/posts/${contentId}/edit`);
    revalidatePath(`/admin/content/${contentId}/revisions`);
  }
}

export async function savePostAction(
  _previousState: PostEditorActionState,
  formData: FormData,
): Promise<PostEditorActionState> {
  const parsed = postEditorSchema.safeParse({
    body: formData.get("body"),
    categoryId: formData.get("categoryId") ?? "",
    changeReason: formData.get("changeReason") ?? "",
    contentId: formData.get("contentId") ?? "",
    expectedLockVersion: formData.get("expectedLockVersion") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
    imageAssetId: formData.get("imageAssetId") ?? "",
    isSpoiler: formData.get("isSpoiler") === "on",
    locationId: formData.get("locationId") ?? "",
    postedAt: formData.get("postedAt"),
    projectId: formData.get("projectId") ?? "",
    publishAt: formData.get("publishAt") ?? "",
    slug: formData.get("slug"),
    status: formData.get("status"),
    tagIds: formData
      .getAll("tagIds")
      .filter((value): value is string => typeof value === "string"),
    title: formData.get("title") ?? "",
    watermarkEnabled: formData.get("watermarkEnabled") === "on",
  });

  if (!parsed.success) {
    return {
      message:
        "入力内容を確認してください。slugは半角英小文字・数字・ハイフンを使用します。",
      status: "error",
    };
  }

  let postedAt: string;
  let publishAt: string | null = null;

  try {
    postedAt = parseTokyoDateTimeLocal(parsed.data.postedAt);
    publishAt = parsed.data.publishAt
      ? parseTokyoDateTimeLocal(parsed.data.publishAt)
      : null;
  } catch {
    return {
      message: "日時を確認してください。日時は日本時間として保存します。",
      status: "error",
    };
  }

  const { supabase } = await requireAdmin({
    nextPath: parsed.data.contentId
      ? `/admin/posts/${parsed.data.contentId}/edit`
      : "/admin/posts/new",
  });
  const { data, error } = await supabase.rpc("admin_save_post", {
    p_body_markdown: parsed.data.body,
    p_change_reason: parsed.data.changeReason,
    p_content_item_id: parsed.data.contentId,
    p_expected_lock_version: parsed.data.expectedLockVersion,
    p_excerpt: parsed.data.excerpt,
    p_external_url: parsed.data.externalUrl,
    p_image_asset_id: parsed.data.imageAssetId,
    p_is_spoiler: parsed.data.isSpoiler,
    p_location_id: parsed.data.locationId,
    p_post_category_id: parsed.data.categoryId,
    p_posted_at: postedAt,
    p_project_id: parsed.data.projectId,
    p_publish_at: publishAt,
    p_slug: parsed.data.slug,
    p_status: parsed.data.status,
    p_tag_ids: parsed.data.tagIds,
    p_title: parsed.data.title,
    p_watermark_enabled: parsed.data.watermarkEnabled,
  });

  if (error) {
    if (error.code === "40001") {
      return {
        message:
          "別の更新が先に保存されました。本文を退避してから画面を再読込し、変更を確認してください。",
        status: "error",
      };
    }

    if (error.code === "23505") {
      return {
        message:
          "同じslugのBlog投稿がすでにあります。別のslugを指定してください。",
        status: "error",
      };
    }

    return {
      message: "投稿を保存できませんでした。入力と接続状態を確認してください。",
      status: "error",
    };
  }

  const result = Array.isArray(data) ? data[0] : data;
  const contentId = result?.saved_content_item_id;

  if (typeof contentId !== "string") {
    return {
      message: "投稿は保存されましたが、保存結果を確認できませんでした。",
      status: "error",
    };
  }

  revalidateContentPaths(contentId);
  redirect(`/admin/posts/${contentId}/edit?saved=1`);
}

export async function setContentTrashAction(formData: FormData) {
  const parsed = contentMutationSchema.safeParse({
    contentId: formData.get("contentId"),
    expectedLockVersion: formData.get("expectedLockVersion"),
  });
  const mode = formData.get("mode");

  if (!parsed.success || (mode !== "trash" && mode !== "restore")) {
    redirect("/admin/posts?error=invalid");
  }

  const { supabase } = await requireAdmin({
    nextPath: mode === "trash" ? "/admin/posts" : "/admin/trash",
  });
  const { error } = await supabase.rpc("admin_set_content_trashed", {
    p_content_item_id: parsed.data.contentId,
    p_expected_lock_version: parsed.data.expectedLockVersion,
    p_trashed: mode === "trash",
  });

  if (error) {
    redirect(
      `${mode === "trash" ? "/admin/posts" : "/admin/trash"}?error=${error.code === "40001" ? "conflict" : "save"}`,
    );
  }

  revalidateContentPaths(parsed.data.contentId);
  redirect(
    mode === "trash"
      ? "/admin/posts?changed=trashed"
      : "/admin/trash?changed=restored",
  );
}

export async function purgeContentAction(formData: FormData) {
  const contentId = formData.get("contentId");
  const confirmation = formData.get("confirmation");
  const confirmed = formData.get("confirmPermanent") === "on";

  if (
    typeof contentId !== "string" ||
    !z.string().uuid().safeParse(contentId).success ||
    typeof confirmation !== "string" ||
    !confirmed
  ) {
    redirect("/admin/trash?error=confirmation");
  }

  const { supabase, userId } = await requireAdmin({ nextPath: "/admin/trash" });
  const { data: target, error: targetError } = await supabase
    .from("content_items")
    .select("id,title,slug,deleted_at")
    .eq("id", contentId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  const expectedConfirmation = target?.title?.trim() || target?.slug;

  if (targetError || !target || confirmation !== expectedConfirmation) {
    redirect("/admin/trash?error=confirmation");
  }

  const { data: jobId, error: requestError } = await supabase.rpc(
    "admin_request_content_purge",
    { p_content_item_id: contentId },
  );

  if (requestError || typeof jobId !== "string") {
    redirect("/admin/trash?error=purge");
  }

  const service = createServiceSupabaseClient();
  const { data: rawManifest, error: prepareError } = await service.rpc(
    "service_prepare_content_purge",
    { p_job_id: jobId },
  );
  const manifest = purgeManifestSchema.safeParse(rawManifest);

  if (prepareError || !manifest.success) {
    await service.rpc("service_fail_content_purge", {
      p_error: "Purge manifest preparation failed",
      p_job_id: jobId,
    });
    redirect("/admin/trash?error=purge");
  }

  for (const bucket of [
    "private-originals",
    "public-media",
    "private-downloads",
  ] as const) {
    const paths = manifest.data
      .filter((entry) => entry.bucket_id === bucket)
      .map((entry) => entry.object_path);

    if (paths.length === 0) {
      continue;
    }

    const { error } = await service.storage.from(bucket).remove(paths);

    if (error) {
      await service.rpc("service_fail_content_purge", {
        p_error: `Storage deletion failed for ${bucket}`,
        p_job_id: jobId,
      });
      redirect("/admin/trash?error=storage");
    }
  }

  const { error: completeError } = await service.rpc(
    "service_complete_content_purge",
    { p_actor_user_id: userId, p_job_id: jobId },
  );

  if (completeError) {
    await service.rpc("service_fail_content_purge", {
      p_error: "Database completion failed after Storage deletion",
      p_job_id: jobId,
    });
    redirect("/admin/trash?error=purge");
  }

  revalidateContentPaths(contentId);
  redirect("/admin/trash?changed=purged");
}

export async function restoreContentRevisionAction(formData: FormData) {
  const revisionId = formData.get("revisionId");
  const contentId = formData.get("contentId");

  if (
    typeof revisionId !== "string" ||
    typeof contentId !== "string" ||
    !z.string().uuid().safeParse(revisionId).success ||
    !z.string().uuid().safeParse(contentId).success
  ) {
    redirect("/admin/posts?error=invalid");
  }

  const { supabase } = await requireAdmin({
    nextPath: `/admin/content/${contentId}/revisions`,
  });
  const { data, error } = await supabase.rpc("admin_restore_content_revision", {
    p_expected_content_item_id: contentId,
    p_revision_id: revisionId,
  });
  const result = Array.isArray(data) ? data[0] : data;

  if (error || result?.restored_content_item_id !== contentId) {
    redirect(`/admin/content/${contentId}/revisions?error=restore`);
  }

  revalidateContentPaths(contentId);
  redirect(`/admin/posts/${contentId}/edit?restored=1`);
}
