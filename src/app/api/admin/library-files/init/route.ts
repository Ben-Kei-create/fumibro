import { NextResponse } from "next/server";

import { JsonRequestError, readLimitedJson } from "@/lib/http/json-request";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { AdminApiAuthorizationError } from "@/modules/auth/application/require-admin-api";
import { LibraryFileError } from "@/modules/library-files/application/errors";
import { initializeLibraryUpload } from "@/modules/library-files/application/initialize-library-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
    status,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return json({ error: "same_origin_required" }, 403);
  try {
    const input = await readLimitedJson(request, 4096);
    return json(await initializeLibraryUpload(input), 201);
  } catch (error) {
    if (error instanceof AdminApiAuthorizationError)
      return json({ error: "admin_authorization_required" }, error.status);
    if (error instanceof LibraryFileError)
      return json({ error: error.code, message: error.message }, error.status);
    if (error instanceof JsonRequestError)
      return json({ error: "invalid_json" }, 400);
    return json({ error: "upload_initialization_failed" }, 500);
  }
}
