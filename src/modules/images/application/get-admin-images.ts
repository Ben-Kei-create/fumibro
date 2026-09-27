import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";
import type {
  DistributionClearance,
  DownloadableImageStatus,
  ImageLicenseType,
} from "@/modules/images/domain/downloadable-image";

export type AdminDownloadableImageDto = {
  adsEnabled: boolean;
  assetId: string;
  description: string;
  distributionClearance: DistributionClearance;
  downloadAssetId: string;
  downloadCount: number;
  downloadEnabled: boolean;
  id: string;
  licenseType: ImageLicenseType;
  lockVersion: number;
  projectId: string;
  publishedAt: string | null;
  slug: string;
  sourceSystem: string;
  sourceWorkTitle: string;
  status: DownloadableImageStatus;
  tagIds: string[];
  thumbnailUrl: string | null;
  title: string;
  useExamples: string;
};

export async function getAdminImages() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/images" });
  const [images, projects, tags, sources] = await Promise.all([
    supabase
      .from("downloadable_images")
      .select(
        "id,title,slug,description,use_examples,project_id,source_work_title,source_system,license_type,distribution_clearance,status,download_enabled,ads_enabled,published_at,asset_id,download_asset_id,download_count,lock_version",
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("projects")
      .select("id,name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("tags")
      .select("id,label")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("content_source_systems")
      .select("code,label")
      .eq("is_enabled", true)
      .order("code"),
  ]);
  const ids = (images.data ?? []).map((image) => image.id);
  const assetIds = (images.data ?? []).map((image) => image.asset_id);
  const [relations, variants] = await Promise.all([
    ids.length
      ? supabase
          .from("downloadable_image_tags")
          .select("downloadable_image_id,tag_id")
          .in("downloadable_image_id", ids)
      : Promise.resolve({
          data: [] as Array<{ downloadable_image_id: string; tag_id: string }>,
        }),
    assetIds.length
      ? supabase
          .from("asset_variants")
          .select("asset_id,object_path")
          .in("asset_id", assetIds)
          .eq("variant_role", "thumbnail")
      : Promise.resolve({
          data: [] as Array<{ asset_id: string; object_path: string }>,
        }),
  ]);

  return {
    hasError: Boolean(
      images.error || projects.error || tags.error || sources.error,
    ),
    images: (images.data ?? []).map((image) => {
      const thumbnailPath = (variants.data ?? []).find(
        (variant) => variant.asset_id === image.asset_id,
      )?.object_path;
      return {
        adsEnabled: image.ads_enabled,
        assetId: image.asset_id,
        description: image.description,
        distributionClearance:
          image.distribution_clearance as DistributionClearance,
        downloadAssetId: image.download_asset_id,
        downloadCount: Number(image.download_count),
        downloadEnabled: image.download_enabled,
        id: image.id,
        licenseType: image.license_type as ImageLicenseType,
        lockVersion: image.lock_version,
        projectId: image.project_id ?? "",
        publishedAt: image.published_at,
        slug: image.slug,
        sourceSystem: image.source_system,
        sourceWorkTitle: image.source_work_title ?? "",
        status: image.status as DownloadableImageStatus,
        tagIds: (relations.data ?? [])
          .filter((relation) => relation.downloadable_image_id === image.id)
          .map((relation) => relation.tag_id),
        thumbnailUrl: thumbnailPath
          ? supabase.storage.from("public-media").getPublicUrl(thumbnailPath)
              .data.publicUrl
          : null,
        title: image.title,
        useExamples: image.use_examples,
      } satisfies AdminDownloadableImageDto;
    }),
    projects: projects.data ?? [],
    sources: sources.data ?? [],
    tags: tags.data ?? [],
  };
}
