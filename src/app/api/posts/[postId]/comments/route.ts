import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { JsonRequestError, readLimitedJson } from "@/lib/http/json-request";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { commentInputSchema } from "@/modules/comments/domain/comment-input";
import { isPlausibleFormDuration } from "@/modules/contact/domain/contact-message";
import {
  VISITOR_COOKIE_NAME,
  deriveVisitorKey,
  normalizeVisitorId,
  visitorCookieOptions,
} from "@/modules/visitors/domain/anonymous-visitor";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/posts/[postId]/comments">,
) {
  if (!isSameOriginRequest(request))
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  const { postId: rawPostId } = await context.params;
  const postId = z.string().uuid().safeParse(rawPostId);
  if (!postId.success)
    return NextResponse.json(
      { message: "投稿が見つかりません。" },
      { status: 404 },
    );
  let input: unknown;
  try {
    input = await readLimitedJson(request, 8192);
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
  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success || !isPlausibleFormDuration(parsed.data.startedAt))
    return NextResponse.json(
      { message: "入力内容を確認してください。" },
      { status: 400 },
    );

  const visitorId = normalizeVisitorId(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  let response: NextResponse;
  if (parsed.data.website) {
    response = NextResponse.json({ ok: true }, { status: 202 });
  } else {
    const service = createServiceSupabaseClient();
    const [generalLimit, duplicateLimit] = await Promise.all([
      service.rpc("service_consume_rate_limit", {
        p_action_key: "comment.submit",
        p_limit: 5,
        p_subject_key: deriveVisitorKey(
          visitorId,
          `rate-limit:comment:${postId.data}`,
        ),
        p_window_seconds: 3600,
      }),
      service.rpc("service_consume_rate_limit", {
        p_action_key: "comment.duplicate",
        p_limit: 1,
        p_subject_key: deriveVisitorKey(
          visitorId,
          `duplicate:comment:${postId.data}:${parsed.data.displayName}:${parsed.data.body}`,
        ),
        p_window_seconds: 300,
      }),
    ]);
    if (generalLimit.error || duplicateLimit.error) {
      response = NextResponse.json(
        { message: "コメントを処理できません。" },
        { status: 500 },
      );
    } else if (!generalLimit.data || !duplicateLimit.data) {
      response = NextResponse.json(
        { message: "連続投稿を防止しています。時間をおいてください。" },
        { status: 429 },
      );
    } else {
      const setting = await service
        .from("site_settings")
        .select("value")
        .eq("setting_key", "comments.approval_mode")
        .maybeSingle();
      const status =
        setting.data?.value === "immediate" ? "visible" : "pending";
      const insertion = await service.rpc("service_create_comment", {
        p_body: parsed.data.body,
        p_display_name: parsed.data.displayName,
        p_post_id: postId.data,
        p_status: status,
      });
      response = insertion.error
        ? NextResponse.json(
            { message: "コメントを保存できません。" },
            { status: 400 },
          )
        : NextResponse.json(
            {
              message:
                status === "pending"
                  ? "承認後に表示されます。"
                  : "コメントを公開しました。",
              ok: true,
            },
            { status: status === "pending" ? 202 : 201 },
          );
    }
  }
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
