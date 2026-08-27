import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { getServerEnvironment } from "@/lib/env/server";

export const VISITOR_COOKIE_NAME = "fumibro_visitor";
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function createVisitorId() {
  return randomBytes(32).toString("base64url");
}

export function normalizeVisitorId(value: string | undefined) {
  return value && VISITOR_ID_PATTERN.test(value) ? value : createVisitorId();
}

export function deriveVisitorKey(visitorId: string, purpose: string) {
  const environment = getServerEnvironment();
  const digest = createHmac("sha256", environment.VISITOR_HMAC_SECRET)
    .update(`fumibro:${purpose}:`)
    .update(visitorId)
    .digest("hex");
  return `\\x${digest}`;
}

export function visitorCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
