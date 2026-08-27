import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginRequest } from "@/lib/http/same-origin";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  VISITOR_COOKIE_NAME,
  deriveVisitorKey,
  normalizeVisitorId,
  visitorCookieOptions,
} from "@/modules/visitors/domain/anonymous-visitor";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/posts/[postId]/likes">,
) {
  if (!isSameOriginRequest(request))
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  const { postId: rawPostId } = await context.params;
  const postId = z.string().uuid().safeParse(rawPostId);
  if (!postId.success)
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  const visitorId = normalizeVisitorId(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  const service = createServiceSupabaseClient();
  const rate = await service.rpc("service_consume_rate_limit", {
    p_action_key: "like.submit",
    p_limit: 60,
    p_subject_key: deriveVisitorKey(visitorId, "rate-limit:like"),
    p_window_seconds: 3600,
  });
  if (rate.error || !rate.data)
    return NextResponse.json(
      { message: "Too many requests." },
      { status: rate.error ? 500 : 429 },
    );
  const result = await service.rpc("service_register_post_like", {
    p_post_id: postId.data,
    p_visitor_key: deriveVisitorKey(visitorId, "like"),
  });
  if (result.error)
    return NextResponse.json(
      { message: "Unable to like post." },
      { status: 404 },
    );
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const response = NextResponse.json({
    accepted: Boolean(row?.accepted),
    total: Number(row?.total ?? 0),
  });
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
