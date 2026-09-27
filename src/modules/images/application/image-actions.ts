"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import { requireAdmin } from "@/modules/auth/application/require-admin";
import {
  distributionClearanceSchema,
  downloadableImageInputSchema,
  downloadableImageStatusSchema,
  imageLicenseSchema,
} from "@/modules/images/domain/downloadable-image";

function optionalUuid(value: FormDataEntryValue | null): string | null {
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function revalidateImages(slug?: string) {
  revalidatePath("/images");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/images");
  if (slug) revalidatePath(`/images/${slug}`);
}

export async function saveDownloadableImageAction(formData: FormData) {
  let publishedAt: string | null = null;
  const status = downloadableImageStatusSchema.safeParse(
    formData.get("status"),
  );
  try {
    const raw = String(formData.get("publishedAt") ?? "");
    publishedAt = raw
      ? parseTokyoDateTimeLocal(raw)
      : status.data === "published"
        ? new Date().toISOString()
        : null;
  } catch {
    redirect("/admin/images?error=published-at");
  }

  const parsed = downloadableImageInputSchema.safeParse({
    adsEnabled: formData.get("adsEnabled") === "on",
    assetId: formData.get("assetId"),
    description: formData.get("description"),
    distributionClearance: formData.get("distributionClearance"),
    downloadAssetId: formData.get("downloadAssetId"),
    downloadEnabled: formData.get("downloadEnabled") === "on",
    expectedLockVersion: Number(formData.get("expectedLockVersion")),
    id: formData.get("imageId"),
    licenseType: formData.get("licenseType"),
    projectId: optionalUuid(formData.get("projectId")),
    publishedAt,
    slug: formData.get("slug"),
    sourceSystem: formData.get("sourceSystem"),
    sourceWorkTitle: formData.get("sourceWorkTitle") ?? "",
    status: formData.get("status"),
    tagIds: formData.getAll("tagIds"),
    title: formData.get("title"),
    useExamples: formData.get("useExamples") ?? "",
  });
  if (!parsed.success) redirect("/admin/images?error=validation");

  const { supabase } = await requireAdmin({ nextPath: "/admin/images" });
  const { error } = await supabase.rpc("admin_save_downloadable_image", {
    p_ads_enabled: parsed.data.adsEnabled,
    p_asset_id: parsed.data.assetId,
    p_description: parsed.data.description,
    p_distribution_clearance: parsed.data.distributionClearance,
    p_download_asset_id: parsed.data.downloadAssetId,
    p_download_enabled: parsed.data.downloadEnabled,
    p_expected_lock_version: parsed.data.expectedLockVersion,
    p_image_id: parsed.data.id,
    p_license_type: parsed.data.licenseType,
    p_project_id: parsed.data.projectId,
    p_published_at: parsed.data.publishedAt,
    p_slug: parsed.data.slug,
    p_source_system: parsed.data.sourceSystem,
    p_source_work_title: parsed.data.sourceWorkTitle || null,
    p_status: parsed.data.status,
    p_tag_ids: parsed.data.tagIds,
    p_title: parsed.data.title,
    p_use_examples: parsed.data.useExamples,
  });
  if (error)
    redirect(`/admin/images?error=${encodeURIComponent(error.code || "save")}`);
  revalidateImages(parsed.data.slug);
  redirect("/admin/images?saved=1");
}

const bulkSchema = z.object({
  adsEnabled: z.boolean(),
  clearance: distributionClearanceSchema,
  downloadEnabled: z.boolean(),
  ids: z.array(z.string().uuid()).min(1).max(30),
  license: imageLicenseSchema,
  projectId: z.string().uuid().nullable(),
  sourceWorkTitle: z.string().trim().max(240),
  status: downloadableImageStatusSchema,
  tagIds: z.array(z.string().uuid()).max(20),
});

export async function bulkUpdateDownloadableImagesAction(formData: FormData) {
  const parsed = bulkSchema.safeParse({
    adsEnabled: formData.get("bulkAdsEnabled") === "on",
    clearance: formData.get("bulkClearance"),
    downloadEnabled: formData.get("bulkDownloadEnabled") === "on",
    ids: formData.getAll("imageIds"),
    license: formData.get("bulkLicense"),
    projectId: optionalUuid(formData.get("bulkProjectId")),
    sourceWorkTitle: formData.get("bulkSourceWorkTitle") ?? "",
    status: formData.get("bulkStatus"),
    tagIds: formData.getAll("bulkTagIds"),
  });
  if (!parsed.success) redirect("/admin/images?error=bulk-validation");
  const { supabase } = await requireAdmin({ nextPath: "/admin/images" });
  const [images, relations] = await Promise.all([
    supabase
      .from("downloadable_images")
      .select(
        "id,title,slug,description,use_examples,source_system,published_at,asset_id,download_asset_id,lock_version",
      )
      .in("id", parsed.data.ids)
      .is("deleted_at", null),
    supabase
      .from("downloadable_image_tags")
      .select("downloadable_image_id,tag_id")
      .in("downloadable_image_id", parsed.data.ids),
  ]);
  if (images.error || images.data?.length !== parsed.data.ids.length) {
    redirect("/admin/images?error=bulk-load");
  }
  for (const image of images.data ?? []) {
    const candidate = downloadableImageInputSchema.safeParse({
      adsEnabled: parsed.data.adsEnabled,
      assetId: image.asset_id,
      description: image.description,
      distributionClearance: parsed.data.clearance,
      downloadAssetId: image.download_asset_id,
      downloadEnabled: parsed.data.downloadEnabled,
      expectedLockVersion: image.lock_version,
      id: image.id,
      licenseType: parsed.data.license,
      projectId: parsed.data.projectId,
      publishedAt:
        parsed.data.status === "published"
          ? (image.published_at ?? new Date().toISOString())
          : image.published_at,
      slug: image.slug,
      sourceSystem: image.source_system,
      sourceWorkTitle: parsed.data.sourceWorkTitle,
      status: parsed.data.status,
      tagIds: parsed.data.tagIds.length
        ? parsed.data.tagIds
        : (relations.data ?? [])
            .filter((item) => item.downloadable_image_id === image.id)
            .map((item) => item.tag_id),
      title: image.title,
      useExamples: image.use_examples,
    });
    if (!candidate.success) redirect("/admin/images?error=bulk-content");
    const { error } = await supabase.rpc("admin_save_downloadable_image", {
      p_ads_enabled: candidate.data.adsEnabled,
      p_asset_id: candidate.data.assetId,
      p_description: candidate.data.description,
      p_distribution_clearance: candidate.data.distributionClearance,
      p_download_asset_id: candidate.data.downloadAssetId,
      p_download_enabled: candidate.data.downloadEnabled,
      p_expected_lock_version: candidate.data.expectedLockVersion,
      p_image_id: candidate.data.id,
      p_license_type: candidate.data.licenseType,
      p_project_id: candidate.data.projectId,
      p_published_at: candidate.data.publishedAt,
      p_slug: candidate.data.slug,
      p_source_system: candidate.data.sourceSystem,
      p_source_work_title: candidate.data.sourceWorkTitle || null,
      p_status: candidate.data.status,
      p_tag_ids: candidate.data.tagIds,
      p_title: candidate.data.title,
      p_use_examples: candidate.data.useExamples,
    });
    if (error)
      redirect(
        `/admin/images?error=${encodeURIComponent(error.code || "bulk-save")}`,
      );
  }
  revalidateImages();
  redirect("/admin/images?saved=bulk");
}
