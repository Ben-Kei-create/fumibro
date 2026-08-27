import { NextResponse } from "next/server";

import { JsonRequestError, readLimitedJson } from "@/lib/http/json-request";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { AdminApiAuthorizationError } from "@/modules/auth/application/require-admin-api";
import { completeLibraryUpload } from "@/modules/library-files/application/complete-library-upload";
import { LibraryFileError } from "@/modules/library-files/application/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
    status,
  });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/library-files/[assetId]/complete">,
) {
  if (!isSameOriginRequest(request))
    return json({ error: "same_origin_required" }, 403);
  try {
    const { assetId } = await context.params;
    const input = await readLimitedJson(request, 4096);
    return json(
      await completeLibraryUpload({
        ...(typeof input === "object" && input ? input : {}),
        assetId,
      }),
    );
  } catch (error) {
    if (error instanceof AdminApiAuthorizationError)
      return json({ error: "admin_authorization_required" }, error.status);
    if (error instanceof LibraryFileError)
      return json({ error: error.code, message: error.message }, error.status);
    if (error instanceof JsonRequestError)
      return json({ error: "invalid_json" }, 400);
    return json({ error: "upload_completion_failed" }, 500);
  }
}
