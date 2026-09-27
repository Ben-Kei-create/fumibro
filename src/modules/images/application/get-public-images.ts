import "server-only";

import { cache } from "react";

import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { ImageLicenseType } from "@/modules/images/domain/downloadable-image";

export type PublicDownloadableImageDto = {
  adsEnabled: boolean;
  description: string;
  display: { altText: string; height: number; url: string; width: number };
  downloadCount: number;
  downloadEnabled: boolean;
  downloadHeight: number;
  downloadWidth: number;
  format: string;
  id: string;
  licenseType: ImageLicenseType;
  project: { id: string; name: string; slug: string } | null;
  publishedAt: string;
  sizeBytes: number;
  slug: string;
  sourceWorkTitle: string | null;
  tags: Array<{ label: string; slug: string }>;
  thumbnail: { altText: string; height: number; url: string; width: number };
  title: string;
  useExamples: string;
};

type ImageRow = {
  ads_enabled: boolean;
  asset_id: string;
  description: string;
  download_asset_id: string;
  download_count: number;
  download_enabled: boolean;
  id: string;
  license_type: ImageLicenseType;
  project_id: string | null;
  published_at: string;
  slug: string;
  source_work_title: string | null;
  title: string;
  use_examples: string;
};

async function hydrate(
  rows: ImageRow[],
): Promise<PublicDownloadableImageDto[]> {
  if (!rows.length) return [];
  const supabase = createPublicSupabaseClient();
  const service = createServiceSupabaseClient();
  const ids = rows.map((row) => row.id);
  const assetIds = [
    ...new Set(rows.flatMap((row) => [row.asset_id, row.download_asset_id])),
  ];
  const projectIds = [
    ...new Set(rows.flatMap((row) => (row.project_id ? [row.project_id] : []))),
  ];
  const [assets, variants, deliveryVariants, relations, projects] =
    await Promise.all([
      supabase.from("assets").select("id,alt_text").in("id", assetIds),
      supabase
        .from("asset_variants")
        .select(
          "asset_id,variant_role,bucket_id,object_path,mime_type,size_bytes,width,height",
        )
        .in("asset_id", assetIds)
        .in("variant_role", ["display", "thumbnail"]),
      service
        .from("asset_variants")
        .select(
          "asset_id,variant_role,bucket_id,mime_type,size_bytes,width,height",
        )
        .in("asset_id", assetIds)
        .eq("variant_role", "download")
        .eq("bucket_id", "private-downloads"),
      supabase
        .from("downloadable_image_tags")
        .select("downloadable_image_id,tag_id")
        .in("downloadable_image_id", ids),
      projectIds.length
        ? supabase.from("projects").select("id,name,slug").in("id", projectIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; name: string; slug: string }>,
          }),
    ]);
  const tagIds = [
    ...new Set((relations.data ?? []).map((item) => item.tag_id)),
  ];
  const tags = tagIds.length
    ? await supabase.from("tags").select("id,label,slug").in("id", tagIds)
    : { data: [] as Array<{ id: string; label: string; slug: string }> };
  const altByAsset = new Map(
    (assets.data ?? []).map((asset) => [asset.id, asset.alt_text ?? ""]),
  );
  const variantsByKey = new Map(
    (variants.data ?? []).map((variant) => [
      `${variant.asset_id}:${variant.variant_role}`,
      variant,
    ]),
  );
  const deliveryByAsset = new Map(
    (deliveryVariants.data ?? []).map((variant) => [variant.asset_id, variant]),
  );
  const projectsById = new Map(
    (projects.data ?? []).map((project) => [project.id, project]),
  );
  const tagsById = new Map((tags.data ?? []).map((tag) => [tag.id, tag]));

  return rows.flatMap((row) => {
    const display = variantsByKey.get(`${row.asset_id}:display`);
    const thumbnail = variantsByKey.get(`${row.asset_id}:thumbnail`);
    const download = deliveryByAsset.get(row.download_asset_id);
    if (
      !display?.width ||
      !display.height ||
      !thumbnail?.width ||
      !thumbnail.height ||
      !download?.width ||
      !download.height
    )
      return [];
    const altText = altByAsset.get(row.asset_id) || row.title;
    const project = row.project_id
      ? (projectsById.get(row.project_id) ?? null)
      : null;
    return [
      {
        adsEnabled: row.ads_enabled,
        description: row.description,
        display: {
          altText,
          height: display.height,
          url: supabase.storage
            .from("public-media")
            .getPublicUrl(display.object_path).data.publicUrl,
          width: display.width,
        },
        downloadCount: Number(row.download_count),
        downloadEnabled: row.download_enabled,
        downloadHeight: download.height,
        downloadWidth: download.width,
        format:
          download.mime_type === "image/webp" ? "WebP" : download.mime_type,
        id: row.id,
        licenseType: row.license_type,
        project,
        publishedAt: row.published_at,
        sizeBytes: Number(download.size_bytes),
        slug: row.slug,
        sourceWorkTitle: row.source_work_title,
        tags: (relations.data ?? [])
          .filter((relation) => relation.downloadable_image_id === row.id)
          .flatMap((relation) => {
            const tag = tagsById.get(relation.tag_id);
            return tag ? [{ label: tag.label, slug: tag.slug }] : [];
          }),
        thumbnail: {
          altText,
          height: thumbnail.height,
          url: supabase.storage
            .from("public-media")
            .getPublicUrl(thumbnail.object_path).data.publicUrl,
          width: thumbnail.width,
        },
        title: row.title,
        useExamples: row.use_examples,
      },
    ];
  });
}

export const getPublicImages = cache(
  async (): Promise<PublicDownloadableImageDto[]> => {
    const supabase = createPublicSupabaseClient();
    const result = await supabase
      .from("downloadable_images")
      .select(
        "id,title,slug,description,use_examples,project_id,source_work_title,license_type,download_enabled,ads_enabled,published_at,asset_id,download_asset_id,download_count",
      )
      .order("published_at", { ascending: false })
      .limit(100);
    return hydrate((result.data ?? []) as ImageRow[]);
  },
);

export const getPublicImage = cache(
  async (slug: string): Promise<PublicDownloadableImageDto | null> => {
    const supabase = createPublicSupabaseClient();
    const result = await supabase
      .from("downloadable_images")
      .select(
        "id,title,slug,description,use_examples,project_id,source_work_title,license_type,download_enabled,ads_enabled,published_at,asset_id,download_asset_id,download_count",
      )
      .eq("slug", slug)
      .maybeSingle();
    const [image] = await hydrate(result.data ? [result.data as ImageRow] : []);
    return image ?? null;
  },
);

export async function getRelatedPublicImages(
  image: PublicDownloadableImageDto,
) {
  const all = await getPublicImages();
  const tagSlugs = new Set(image.tags.map((tag) => tag.slug));
  return all
    .filter((candidate) => candidate.id !== image.id)
    .sort((left, right) => {
      const leftScore =
        Number(left.project?.id === image.project?.id) +
        left.tags.filter((tag) => tagSlugs.has(tag.slug)).length;
      const rightScore =
        Number(right.project?.id === image.project?.id) +
        right.tags.filter((tag) => tagSlugs.has(tag.slug)).length;
      return rightScore - leftScore;
    })
    .slice(0, 6);
}
