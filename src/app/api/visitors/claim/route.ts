import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { JsonRequestError, readLimitedJson } from "@/lib/http/json-request";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  VISITOR_COOKIE_NAME,
  deriveVisitorKey,
  normalizeVisitorId,
  visitorCookieOptions,
} from "@/modules/visitors/domain/anonymous-visitor";

const claimSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("site") }),
  z.object({ projectId: z.string().uuid(), scope: z.literal("project") }),
]);

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request))
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  let input: unknown;
  try {
    input = await readLimitedJson(request, 1024);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof JsonRequestError
            ? error.message
            : "Invalid request.",
      },
      { status: 400 },
    );
  }
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json({ message: "Invalid scope." }, { status: 400 });

  const visitorId = normalizeVisitorId(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  const service = createServiceSupabaseClient();
  const purpose =
    parsed.data.scope === "site"
      ? "visit:site"
      : `visit:project:${parsed.data.projectId}`;
  const visitorKey = deriveVisitorKey(visitorId, purpose);
  const result =
    parsed.data.scope === "site"
      ? await service.rpc("service_register_site_visit", {
          p_visitor_key: visitorKey,
        })
      : await service.rpc("service_register_project_visit", {
          p_project_id: parsed.data.projectId,
          p_visitor_key: visitorKey,
        });
  if (result.error)
    return NextResponse.json(
      { message: "Unable to count visit." },
      { status: 500 },
    );
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const response = NextResponse.json({ total: Number(row?.total ?? 0) });
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
