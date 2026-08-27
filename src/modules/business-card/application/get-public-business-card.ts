import "server-only";

import { createPublicSupabaseClient } from "@/lib/supabase/public";

export async function getPublicBusinessCard(slug: string) {
  const supabase = createPublicSupabaseClient();
  const cardResult = await supabase
    .from("business_cards")
    .select(
      "id,slug,display_name,organization,job_title,email,phone,website,address,note,png_asset_id",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!cardResult.data) return null;
  const linksResult = await supabase
    .from("business_card_links")
    .select("label,url")
    .eq("business_card_id", cardResult.data.id)
    .order("display_order");

  return { ...cardResult.data, links: linksResult.data ?? [] };
}

export async function getPublicBusinessCardPng(slug: string) {
  const supabase = createPublicSupabaseClient();
  const card = await getPublicBusinessCard(slug);
  if (!card?.png_asset_id) return null;
  const variant = await supabase
    .from("asset_variants")
    .select("variant_role,object_path,mime_type")
    .eq("asset_id", card.png_asset_id)
    .in("variant_role", ["card_png", "display"])
    .eq("bucket_id", "public-media")
    .limit(2);
  const selected =
    variant.data?.find((item) => item.variant_role === "card_png") ??
    variant.data?.find((item) => item.variant_role === "display");
  if (!selected) return null;
  return {
    mimeType: selected.mime_type,
    publicUrl: supabase.storage
      .from("public-media")
      .getPublicUrl(selected.object_path).data.publicUrl,
  };
}
