import { NextRequest, NextResponse } from "next/server";

import { JsonRequestError, readLimitedJson } from "@/lib/http/json-request";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { submitContactMessage } from "@/modules/contact/application/submit-contact-message";
import {
  contactMessageSchema,
  isPlausibleFormDuration,
} from "@/modules/contact/domain/contact-message";
import {
  VISITOR_COOKIE_NAME,
  deriveVisitorKey,
  normalizeVisitorId,
  visitorCookieOptions,
} from "@/modules/visitors/domain/anonymous-visitor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  let rawInput: unknown;
  try {
    rawInput = await readLimitedJson(request, 16_384);
  } catch (error) {
    const message =
      error instanceof JsonRequestError ? error.message : "Invalid request.";
    return NextResponse.json({ message }, { status: 400 });
  }
  const parsed = contactMessageSchema.safeParse(rawInput);
  if (!parsed.success || !isPlausibleFormDuration(parsed.data.startedAt)) {
    return NextResponse.json(
      { message: "入力内容を確認してください。" },
      { status: 400 },
    );
  }

  const visitorId = normalizeVisitorId(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  let response: NextResponse;

  if (parsed.data.website) {
    response = NextResponse.json({ ok: true }, { status: 202 });
  } else {
    const result = await submitContactMessage(
      parsed.data,
      deriveVisitorKey(visitorId, "rate-limit:contact"),
    );
    response = result.ok
      ? NextResponse.json({ ok: true }, { status: 201 })
      : NextResponse.json(
          { message: result.message },
          { status: result.status },
        );
  }
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
