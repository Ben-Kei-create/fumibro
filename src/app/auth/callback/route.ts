import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnvironment } from "@/lib/env/public";

export async function GET(request: NextRequest) {
  const confirmUrl = new URL(
    "/auth/confirm",
    getPublicEnvironment().NEXT_PUBLIC_SITE_URL,
  );
  for (const key of ["code", "sb_flow_id", "token_hash", "type"] as const) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) confirmUrl.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(confirmUrl, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
