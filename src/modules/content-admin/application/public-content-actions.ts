"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import { requireAdmin } from "@/modules/auth/application/require-admin";

export type ContentEditorActionState = {
  message?: string;
  status: "error" | "idle";
};

const optionalUuid = z.union([z.literal(""), z.string().uuid()]);
const optionalHttpUrl = z.union([
  z.literal(""),
  z
    .string()
    .max(2000)
    .refine((value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }),
]);
const commonSchema = z.object({
  changeReason: z.string().trim().max(1000),
  contentId: optionalUuid,
  expectedLockVersion: z.union([
    z.literal(""),
    z.coerce.number().int().positive(),
  ]),
  excerpt: z.string().trim().max(1000),
  projectId: optionalUuid,
  publishAt: z.string(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  status: z.enum(["draft", "published", "hidden"]),
  tagIds: z.array(z.string().uuid()).max(20),
  title: z.string().trim().min(1).max(240),
});

const workSchema = commonSchema.extend({
  description: z.string().max(200000),
  externalUrl: optionalHttpUrl,
  homeDisplayOrder: z.coerce.number().int(),
  imageAssetId: optionalUuid,
  portfolioDisplayOrder: z.coerce.number().int(),
  releasedOn: z.union([z.literal(""), z.string().date()]),
  showInPortfolio: z.boolean(),
  showOnHome: z.boolean(),
  summary: z.string().trim().max(1000),
  workType: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/u),
});

const librarySchema = commonSchema.extend({
  accessPolicy: z.enum([
    "public",
    "free_download",
    "email_gate",
    "paid",
    "restricted",
  ]),
  coverAssetId: optionalUuid,
  description: z.string().max(200000),
  downloadEnabled: z.boolean(),
  inlinePreviewEnabled: z.boolean(),
});

const pageSchema = z.object({
  body: z.string().max(300000),
  changeReason: z.string().trim().max(1000),
  contentId: z.string().uuid(),
  expectedLockVersion: z.coerce.number().int().positive(),
  excerpt: z.string().trim().max(1000),
  publishAt: z.string(),
  seoDescription: z.string().trim().max(320),
  status: z.enum(["draft", "published", "hidden"]),
  title: z.string().trim().min(1).max(240),
});

function readCommon(formData: FormData) {
  return {
    changeReason: formData.get("changeReason") ?? "",
    contentId: formData.get("contentId") ?? "",
    expectedLockVersion: formData.get("expectedLockVersion") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    projectId: formData.get("projectId") ?? "",
    publishAt: formData.get("publishAt") ?? "",
    slug: formData.get("slug"),
    status: formData.get("status"),
    tagIds: formData
      .getAll("tagIds")
      .filter((value): value is string => typeof value === "string"),
    title: formData.get("title"),
  };
}

function parseOptionalPublishAt(value: string) {
  return value ? parseTokyoDateTimeLocal(value) : null;
}

function contentError(error: { code?: string } | null) {
  if (error?.code === "40001")
    return "別の更新が先に保存されました。画面を再読込してください。";
  if (error?.code === "23505") return "同じslugのコンテンツがすでにあります。";
  return "保存できませんでした。入力と接続状態を確認してください。";
}

function revalidatePublicContent(id: string) {
  for (const path of [
    "/",
    "/works",
    "/portfolio",
    "/library",
    "/about",
    "/privacy",
    "/projects",
    "/admin/content",
    `/admin/content/${id}/revisions`,
  ]) {
    revalidatePath(path);
  }
}

export async function saveWorkAction(
  _state: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  const parsed = workSchema.safeParse({
    ...readCommon(formData),
    description: formData.get("description"),
    externalUrl: formData.get("externalUrl") ?? "",
    homeDisplayOrder: formData.get("homeDisplayOrder") ?? "0",
    imageAssetId: formData.get("imageAssetId") ?? "",
    portfolioDisplayOrder: formData.get("portfolioDisplayOrder") ?? "0",
    releasedOn: formData.get("releasedOn") ?? "",
    showInPortfolio: formData.get("showInPortfolio") === "on",
    showOnHome: formData.get("showOnHome") === "on",
    summary: formData.get("summary") ?? "",
    workType: formData.get("workType"),
  });
  if (!parsed.success)
    return { message: "作品の入力内容を確認してください。", status: "error" };
  let publishAt: string | null;
  try {
    publishAt = parseOptionalPublishAt(parsed.data.publishAt);
  } catch {
    return { message: "公開日時を確認してください。", status: "error" };
  }
  const { supabase } = await requireAdmin({ nextPath: "/admin/works" });
  const { data, error } = await supabase.rpc("admin_save_work", {
    p_change_reason: parsed.data.changeReason,
    p_content_item_id: parsed.data.contentId || null,
    p_description_markdown: parsed.data.description,
    p_expected_lock_version: parsed.data.expectedLockVersion || null,
    p_excerpt: parsed.data.excerpt,
    p_external_url: parsed.data.externalUrl || null,
    p_home_display_order: parsed.data.homeDisplayOrder,
    p_image_asset_id: parsed.data.imageAssetId || null,
    p_portfolio_display_order: parsed.data.portfolioDisplayOrder,
    p_project_id: parsed.data.projectId || null,
    p_publish_at: publishAt,
    p_released_on: parsed.data.releasedOn || null,
    p_show_in_portfolio: parsed.data.showInPortfolio,
    p_show_on_home: parsed.data.showOnHome,
    p_slug: parsed.data.slug,
    p_status: parsed.data.status,
    p_summary: parsed.data.summary,
    p_tag_ids: parsed.data.tagIds,
    p_title: parsed.data.title,
    p_work_type: parsed.data.workType,
  });
  if (error) return { message: contentError(error), status: "error" };
  const result = Array.isArray(data) ? data[0] : data;
  const id = result?.saved_content_item_id;
  if (typeof id !== "string")
    return { message: "保存結果を確認できませんでした。", status: "error" };
  revalidatePublicContent(id);
  redirect(`/admin/works/${id}/edit?saved=1`);
}

export async function saveLibraryAction(
  _state: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  const parsed = librarySchema.safeParse({
    ...readCommon(formData),
    accessPolicy: formData.get("accessPolicy"),
    coverAssetId: formData.get("imageAssetId") ?? "",
    description: formData.get("description"),
    downloadEnabled: formData.get("downloadEnabled") === "on",
    inlinePreviewEnabled: formData.get("inlinePreviewEnabled") === "on",
  });
  if (!parsed.success)
    return {
      message: "Libraryの入力内容を確認してください。",
      status: "error",
    };
  let publishAt: string | null;
  try {
    publishAt = parseOptionalPublishAt(parsed.data.publishAt);
  } catch {
    return { message: "公開日時を確認してください。", status: "error" };
  }
  const { supabase } = await requireAdmin({ nextPath: "/admin/library" });
  const { data, error } = await supabase.rpc("admin_save_library_item", {
    p_access_policy_code: parsed.data.accessPolicy,
    p_change_reason: parsed.data.changeReason,
    p_content_item_id: parsed.data.contentId || null,
    p_cover_asset_id: parsed.data.coverAssetId || null,
    p_description_markdown: parsed.data.description,
    p_download_enabled: parsed.data.downloadEnabled,
    p_expected_lock_version: parsed.data.expectedLockVersion || null,
    p_excerpt: parsed.data.excerpt,
    p_inline_preview_enabled: parsed.data.inlinePreviewEnabled,
    p_project_id: parsed.data.projectId || null,
    p_publish_at: publishAt,
    p_slug: parsed.data.slug,
    p_status: parsed.data.status,
    p_tag_ids: parsed.data.tagIds,
    p_title: parsed.data.title,
  });
  if (error) return { message: contentError(error), status: "error" };
  const result = Array.isArray(data) ? data[0] : data;
  const id = result?.saved_content_item_id;
  if (typeof id !== "string")
    return { message: "保存結果を確認できませんでした。", status: "error" };
  revalidatePublicContent(id);
  redirect(`/admin/library/${id}/edit?saved=1`);
}

export async function savePageAction(
  _state: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  const parsed = pageSchema.safeParse({
    body: formData.get("body"),
    changeReason: formData.get("changeReason") ?? "",
    contentId: formData.get("contentId"),
    expectedLockVersion: formData.get("expectedLockVersion"),
    excerpt: formData.get("excerpt") ?? "",
    publishAt: formData.get("publishAt") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
    status: formData.get("status"),
    title: formData.get("title"),
  });
  if (!parsed.success)
    return { message: "Pageの入力内容を確認してください。", status: "error" };
  let publishAt: string | null;
  try {
    publishAt = parseOptionalPublishAt(parsed.data.publishAt);
  } catch {
    return { message: "公開日時を確認してください。", status: "error" };
  }
  const { supabase } = await requireAdmin({ nextPath: "/admin/pages" });
  const { data, error } = await supabase.rpc("admin_save_page", {
    p_body_markdown: parsed.data.body,
    p_change_reason: parsed.data.changeReason,
    p_content_item_id: parsed.data.contentId,
    p_expected_lock_version: parsed.data.expectedLockVersion,
    p_excerpt: parsed.data.excerpt,
    p_publish_at: publishAt,
    p_seo_description: parsed.data.seoDescription,
    p_status: parsed.data.status,
    p_title: parsed.data.title,
  });
  if (error) return { message: contentError(error), status: "error" };
  const result = Array.isArray(data) ? data[0] : data;
  const id = result?.saved_content_item_id;
  if (typeof id !== "string")
    return { message: "保存結果を確認できませんでした。", status: "error" };
  revalidatePublicContent(id);
  redirect(`/admin/pages/${id}/edit?saved=1`);
}
