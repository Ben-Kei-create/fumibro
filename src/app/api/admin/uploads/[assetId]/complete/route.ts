import { NextResponse } from "next/server";

import { isSameOriginRequest } from "@/lib/http/same-origin";
import { AdminApiAuthorizationError } from "@/modules/auth/application/require-admin-api";
import { completeImageUpload } from "@/modules/media/application/complete-image-upload";
import { MediaApplicationError } from "@/modules/media/application/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

type CompleteUploadContext =
  RouteContext<"/api/admin/uploads/[assetId]/complete">;

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
    status,
  });
}

export async function POST(request: Request, context: CompleteUploadContext) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "same_origin_required" }, 403);
  }

  try {
    const { assetId } = await context.params;
    const image = await completeImageUpload({ assetId });
    return json(image);
  } catch (error) {
    if (error instanceof AdminApiAuthorizationError) {
      return json({ error: "admin_authorization_required" }, error.status);
    }

    if (error instanceof MediaApplicationError) {
      return json({ error: error.code, message: error.message }, error.status);
    }

    return json({ error: "image_processing_failed" }, 500);
  }
}
