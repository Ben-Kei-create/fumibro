import { NextResponse } from "next/server";
import { z } from "zod";

import { JsonRequestError, readLimitedJson } from "@/lib/http/json-request";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import {
  AdminApiAuthorizationError,
  requireAdminApi,
} from "@/modules/auth/application/require-admin-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  images: z
    .array(
      z.object({
        assetId: z.string().uuid(),
        filename: z.string().trim().min(1).max(255),
      }),
    )
    .min(1)
    .max(30),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "same_origin_required" },
      { status: 403 },
    );
  }
  try {
    const { supabase, userId } = await requireAdminApi();
    const parsed = inputSchema.safeParse(
      await readLimitedJson(request, 32_768),
    );
    if (!parsed.success)
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const assetIds = parsed.data.images.map((image) => image.assetId);
    const [assets, variants] = await Promise.all([
      supabase
        .from("assets")
        .select("id,state,created_by,deleted_at")
        .in("id", assetIds),
      supabase
        .from("asset_variants")
        .select("asset_id,variant_role")
        .in("asset_id", assetIds)
        .eq("variant_role", "download"),
    ]);
    const valid = new Set(
      (assets.data ?? [])
        .filter(
          (asset) =>
            asset.state === "ready" &&
            asset.created_by === userId &&
            !asset.deleted_at,
        )
        .filter((asset) =>
          (variants.data ?? []).some(
            (variant) => variant.asset_id === asset.id,
          ),
        )
        .map((asset) => asset.id),
    );
    if (valid.size !== assetIds.length)
      return NextResponse.json({ error: "asset_unavailable" }, { status: 409 });

    const existing = await supabase
      .from("downloadable_images")
      .select("id,asset_id")
      .in("asset_id", assetIds);
    if (existing.error) {
      return NextResponse.json(
        { error: "draft_lookup_failed" },
        { status: 500 },
      );
    }
    const existingByAsset = new Map(
      (existing.data ?? []).map((item) => [item.asset_id, item.id]),
    );
    const created: string[] = [];
    for (const image of parsed.data.images) {
      const existingId = existingByAsset.get(image.assetId);
      if (existingId) {
        created.push(existingId);
        continue;
      }
      const title =
        image.filename
          .replace(/\.[^.]+$/u, "")
          .trim()
          .slice(0, 240) || "画像";
      const slug = `image-${image.assetId.slice(0, 12)}`;
      const result = await supabase.rpc("admin_save_downloadable_image", {
        p_ads_enabled: false,
        p_asset_id: image.assetId,
        p_description: `${title}の配布用画像です。公開前に、この画像固有の説明を入力してください。`,
        p_distribution_clearance: "review_required",
        p_download_asset_id: image.assetId,
        p_download_enabled: false,
        p_expected_lock_version: null,
        p_image_id: null,
        p_license_type: "all_rights_reserved",
        p_project_id: null,
        p_published_at: null,
        p_slug: slug,
        p_source_system: "manual",
        p_source_work_title: null,
        p_status: "draft",
        p_tag_ids: [],
        p_title: title,
        p_use_examples: "",
      });
      if (result.error)
        return NextResponse.json(
          { error: "draft_create_failed" },
          { status: 500 },
        );
      const saved = Array.isArray(result.data) ? result.data[0] : result.data;
      if (saved?.saved_image_id) created.push(saved.saved_image_id);
    }
    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminApiAuthorizationError) {
      return NextResponse.json(
        { error: "admin_authorization_required" },
        { status: error.status },
      );
    }
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    return NextResponse.json({ error: "draft_create_failed" }, { status: 500 });
  }
}
