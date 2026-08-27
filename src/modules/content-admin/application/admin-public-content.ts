import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/modules/auth/application/require-admin";
import type { SelectedImage } from "@/modules/media/domain/selected-image";

export type AdminContentListItem = {
  id: string;
  lockVersion: number;
  publishAt: string | null;
  slug: string;
  status: "draft" | "hidden" | "published";
  title: string;
  updatedAt: string;
};

export type AdminWorkEditor = AdminContentListItem & {
  description: string;
  excerpt: string;
  externalUrl: string;
  homeDisplayOrder: number;
  image?: SelectedImage;
  portfolioDisplayOrder: number;
  projectId: string;
  releasedOn: string;
  showInPortfolio: boolean;
  showOnHome: boolean;
  summary: string;
  tagIds: string[];
  workType: string;
};

export type AdminLibraryEditor = AdminContentListItem & {
  accessPolicy: string;
  cover?: SelectedImage;
  description: string;
  downloadEnabled: boolean;
  excerpt: string;
  inlinePreviewEnabled: boolean;
  projectId: string;
  tagIds: string[];
};

export type AdminLibraryFile = {
  displayName: string;
  id: string;
  isPrimary: boolean;
  mimeType: string;
  sizeBytes: number;
  versionLabel: string;
};

export type AdminPageEditor = AdminContentListItem & {
  body: string;
  excerpt: string;
  isSystem: boolean;
  pageKey: string;
  seoDescription: string;
};

async function getSelectedImage(
  supabase: SupabaseClient,
  assetId: string | null,
): Promise<SelectedImage | undefined> {
  if (!assetId) return undefined;
  const [asset, variants] = await Promise.all([
    supabase
      .from("assets")
      .select("id,alt_text")
      .eq("id", assetId)
      .maybeSingle(),
    supabase
      .from("asset_variants")
      .select("variant_role,object_path")
      .eq("asset_id", assetId)
      .in("variant_role", ["display", "thumbnail"]),
  ]);
  const displayPath = variants.data?.find(
    (variant) => variant.variant_role === "display",
  )?.object_path;
  const thumbnailPath = variants.data?.find(
    (variant) => variant.variant_role === "thumbnail",
  )?.object_path;
  if (!asset.data || !displayPath || !thumbnailPath) return undefined;
  return {
    altText: asset.data.alt_text,
    assetId: asset.data.id,
    displayUrl: supabase.storage.from("public-media").getPublicUrl(displayPath)
      .data.publicUrl,
    thumbnailUrl: supabase.storage
      .from("public-media")
      .getPublicUrl(thumbnailPath).data.publicUrl,
  };
}

export async function getAdminContentList(
  kind: "library" | "page" | "work",
): Promise<AdminContentListItem[]> {
  const nextPath = kind === "page" ? "/admin/pages" : `/admin/${kind}`;
  const { supabase } = await requireAdmin({ nextPath });
  const result = await supabase
    .from("content_items")
    .select("id,slug,title,status,publish_at,lock_version,updated_at")
    .eq("kind", kind)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  return (result.data ?? []).map((item) => ({
    id: item.id,
    lockVersion: item.lock_version,
    publishAt: item.publish_at,
    slug: item.slug,
    status: item.status,
    title: item.title ?? item.slug,
    updatedAt: item.updated_at,
  }));
}

export async function getAdminWork(
  id: string,
): Promise<AdminWorkEditor | null> {
  const { supabase } = await requireAdmin({
    nextPath: `/admin/works/${id}/edit`,
  });
  const [content, detail, tags] = await Promise.all([
    supabase
      .from("content_items")
      .select(
        "id,project_id,slug,title,excerpt,status,publish_at,lock_version,updated_at,deleted_at",
      )
      .eq("id", id)
      .eq("kind", "work")
      .maybeSingle(),
    supabase
      .from("works")
      .select(
        "summary,description_markdown,image_asset_id,released_on,external_url,work_type,show_on_home,home_display_order,show_in_portfolio,portfolio_display_order",
      )
      .eq("content_item_id", id)
      .maybeSingle(),
    supabase.from("content_tags").select("tag_id").eq("content_item_id", id),
  ]);
  if (!content.data || !detail.data || content.data.deleted_at) return null;
  return {
    description: detail.data.description_markdown,
    excerpt: content.data.excerpt ?? "",
    externalUrl: detail.data.external_url ?? "",
    homeDisplayOrder: detail.data.home_display_order,
    id: content.data.id,
    image: await getSelectedImage(supabase, detail.data.image_asset_id),
    lockVersion: content.data.lock_version,
    portfolioDisplayOrder: detail.data.portfolio_display_order,
    projectId: content.data.project_id ?? "",
    publishAt: content.data.publish_at,
    releasedOn: detail.data.released_on ?? "",
    showInPortfolio: detail.data.show_in_portfolio,
    showOnHome: detail.data.show_on_home,
    slug: content.data.slug,
    status: content.data.status,
    summary: detail.data.summary ?? "",
    tagIds: (tags.data ?? []).map((tag) => tag.tag_id),
    title: content.data.title ?? "",
    updatedAt: content.data.updated_at,
    workType: detail.data.work_type,
  };
}

export async function getAdminLibraryItem(
  id: string,
): Promise<AdminLibraryEditor | null> {
  const { supabase } = await requireAdmin({
    nextPath: `/admin/library/${id}/edit`,
  });
  const [content, detail, tags] = await Promise.all([
    supabase
      .from("content_items")
      .select(
        "id,project_id,slug,title,excerpt,status,publish_at,lock_version,updated_at,deleted_at",
      )
      .eq("id", id)
      .eq("kind", "library")
      .maybeSingle(),
    supabase
      .from("library_items")
      .select(
        "description_markdown,access_policy_code,download_enabled,inline_preview_enabled,cover_asset_id",
      )
      .eq("content_item_id", id)
      .maybeSingle(),
    supabase.from("content_tags").select("tag_id").eq("content_item_id", id),
  ]);
  if (!content.data || !detail.data || content.data.deleted_at) return null;
  return {
    accessPolicy: detail.data.access_policy_code,
    cover: await getSelectedImage(supabase, detail.data.cover_asset_id),
    description: detail.data.description_markdown,
    downloadEnabled: detail.data.download_enabled,
    excerpt: content.data.excerpt ?? "",
    id: content.data.id,
    inlinePreviewEnabled: detail.data.inline_preview_enabled,
    lockVersion: content.data.lock_version,
    projectId: content.data.project_id ?? "",
    publishAt: content.data.publish_at,
    slug: content.data.slug,
    status: content.data.status,
    tagIds: (tags.data ?? []).map((tag) => tag.tag_id),
    title: content.data.title ?? "",
    updatedAt: content.data.updated_at,
  };
}

export async function getAdminLibraryFiles(
  libraryItemId: string,
): Promise<AdminLibraryFile[]> {
  const { supabase } = await requireAdmin({
    nextPath: `/admin/library/${libraryItemId}/edit`,
  });
  const files = await supabase
    .from("library_files")
    .select("id,asset_id,display_name,version_label,is_primary,display_order")
    .eq("library_item_id", libraryItemId)
    .is("deleted_at", null)
    .order("display_order");
  const assetIds = (files.data ?? []).map((file) => file.asset_id);
  const assets = assetIds.length
    ? await supabase
        .from("assets")
        .select("id,mime_type,size_bytes")
        .in("id", assetIds)
    : { data: [] };
  const assetMap = new Map(
    (assets.data ?? []).map((asset) => [asset.id, asset]),
  );
  return (files.data ?? []).flatMap((file) => {
    const asset = assetMap.get(file.asset_id);
    return asset
      ? [
          {
            displayName: file.display_name,
            id: file.id,
            isPrimary: file.is_primary,
            mimeType: asset.mime_type,
            sizeBytes: asset.size_bytes,
            versionLabel: file.version_label,
          },
        ]
      : [];
  });
}

export async function getAdminPage(
  id: string,
): Promise<AdminPageEditor | null> {
  const { supabase } = await requireAdmin({
    nextPath: `/admin/pages/${id}/edit`,
  });
  const [content, detail] = await Promise.all([
    supabase
      .from("content_items")
      .select(
        "id,slug,title,excerpt,status,publish_at,lock_version,updated_at,deleted_at",
      )
      .eq("id", id)
      .eq("kind", "page")
      .maybeSingle(),
    supabase
      .from("pages")
      .select("page_key,body_markdown,seo_description,is_system")
      .eq("content_item_id", id)
      .maybeSingle(),
  ]);
  if (!content.data || !detail.data || content.data.deleted_at) return null;
  return {
    body: detail.data.body_markdown,
    excerpt: content.data.excerpt ?? "",
    id: content.data.id,
    isSystem: detail.data.is_system,
    lockVersion: content.data.lock_version,
    pageKey: detail.data.page_key,
    publishAt: content.data.publish_at,
    seoDescription: detail.data.seo_description ?? "",
    slug: content.data.slug,
    status: content.data.status,
    title: content.data.title ?? "",
    updatedAt: content.data.updated_at,
  };
}

export async function getLibraryPolicies() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/library" });
  const result = await supabase
    .from("library_access_policies")
    .select("code,label")
    .eq("is_active", true)
    .order("code");
  return result.data ?? [];
}
