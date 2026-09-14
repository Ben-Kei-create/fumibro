import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  VISITOR_COOKIE_NAME,
  deriveVisitorKey,
  normalizeVisitorId,
  visitorCookieOptions,
} from "@/modules/visitors/domain/anonymous-visitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unavailable(status: number) {
  return NextResponse.json(
    { error: status === 429 ? "rate_limited" : "download_unavailable" },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
      status,
    },
  );
}

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/images/[imageId]/download">,
) {
  const { imageId: rawImageId } = await context.params;
  const imageId = z.string().uuid().safeParse(rawImageId);
  if (!imageId.success) return unavailable(404);
  const visitorId = normalizeVisitorId(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  const service = createServiceSupabaseClient();
  const rate = await service.rpc("service_consume_rate_limit", {
    p_action_key: "images.download",
    p_limit: 30,
    p_subject_key: deriveVisitorKey(visitorId, "rate-limit:images-download"),
    p_window_seconds: 3600,
  });
  if (rate.error || !rate.data) return unavailable(rate.error ? 500 : 429);
  const delivery = await service.rpc(
    "service_record_downloadable_image_download",
    { p_image_id: imageId.data },
  );
  if (delivery.error) return unavailable(500);
  const row = Array.isArray(delivery.data) ? delivery.data[0] : delivery.data;
  if (!row?.object_path || !row.download_filename) return unavailable(404);
  const signed = await service.storage
    .from("private-downloads")
    .createSignedUrl(row.object_path, 60, { download: row.download_filename });
  if (signed.error || !signed.data) return unavailable(502);
  const response = NextResponse.redirect(signed.data.signedUrl, 302);
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions());
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
