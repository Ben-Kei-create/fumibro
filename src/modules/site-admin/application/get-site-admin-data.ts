import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/modules/auth/application/require-admin";
import type { SelectedImage } from "@/modules/media/domain/selected-image";

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
    (item) => item.variant_role === "display",
  )?.object_path;
  const thumbnailPath = variants.data?.find(
    (item) => item.variant_role === "thumbnail",
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

export async function getAdminProjects() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/projects" });
  const result = await supabase
    .from("projects")
    .select("id,slug,name,description,theme_key,display_order,is_active")
    .is("deleted_at", null)
    .order("display_order");
  return result.data ?? [];
}

export async function getAdminTaxonomies() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/settings" });
  const [tags, categories, locations] = await Promise.all([
    supabase
      .from("tags")
      .select("id,label,slug,display_order,is_active")
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("post_categories")
      .select("id,label,slug,icon_key,display_order,is_active")
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("locations")
      .select("id,display_name,maps_query,display_order,is_active")
      .is("deleted_at", null)
      .order("display_order"),
  ]);
  return {
    categories: categories.data ?? [],
    locations: locations.data ?? [],
    tags: tags.data ?? [],
  };
}

export async function getAdminNotices() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/notices" });
  const result = await supabase
    .from("notices")
    .select(
      "id,title,body,link_url,link_label,display_order,status,starts_at,ends_at,deleted_at",
    )
    .is("deleted_at", null)
    .order("display_order")
    .limit(20);
  return result.data ?? [];
}

export async function getAdminBusinessCards() {
  const { supabase } = await requireAdmin({
    nextPath: "/admin/business-cards",
  });
  const result = await supabase
    .from("business_cards")
    .select(
      "id,slug,display_name,organization,job_title,email,phone,website,address,note,png_asset_id,is_primary,is_published,display_order",
    )
    .is("deleted_at", null)
    .order("display_order");
  return Promise.all(
    (result.data ?? []).map(async (card) => ({
      ...card,
      image: await getSelectedImage(supabase, card.png_asset_id),
    })),
  );
}
