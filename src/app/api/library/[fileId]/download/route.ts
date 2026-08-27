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
  context: RouteContext<"/api/library/[fileId]/download">,
) {
  const { fileId: rawFileId } = await context.params;
  const fileId = z.string().uuid().safeParse(rawFileId);
  if (!fileId.success) return unavailable(404);
  const visitorId = normalizeVisitorId(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  const service = createServiceSupabaseClient();
  const rate = await service.rpc("service_consume_rate_limit", {
    p_action_key: "library.download",
    p_limit: 30,
    p_subject_key: deriveVisitorKey(visitorId, "rate-limit:library-download"),
    p_window_seconds: 3600,
  });
  if (rate.error || !rate.data) return unavailable(rate.error ? 500 : 429);
  const allowed = await service.rpc(
    "service_library_file_is_anonymously_downloadable",
    {
      p_library_file_id: fileId.data,
    },
  );
  if (allowed.error || !allowed.data) return unavailable(404);

  const file = await service
    .from("library_files")
    .select("asset_id,display_name")
    .eq("id", fileId.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (file.error || !file.data) return unavailable(404);
  const variant = await service
    .from("asset_variants")
    .select("object_path")
    .eq("asset_id", file.data.asset_id)
    .eq("variant_role", "download")
    .eq("bucket_id", "private-downloads")
    .maybeSingle();
  if (variant.error || !variant.data) return unavailable(404);
  const signed = await service.storage
    .from("private-downloads")
    .createSignedUrl(variant.data.object_path, 60, {
      download: file.data.display_name,
    });
  if (signed.error || !signed.data) return unavailable(502);

  const response = NextResponse.redirect(signed.data.signedUrl, 302);
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions());
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
