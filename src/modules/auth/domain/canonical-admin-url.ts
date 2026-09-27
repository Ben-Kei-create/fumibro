const ADMIN_PATH_PREFIX = "/admin";
const AUTH_CALLBACK_PATHS = new Set(["/auth/callback", "/auth/confirm"]);

function isAdminOrAuthCallback(pathname: string) {
  return (
    pathname === ADMIN_PATH_PREFIX ||
    pathname.startsWith(`${ADMIN_PATH_PREFIX}/`) ||
    AUTH_CALLBACK_PATHS.has(pathname)
  );
}

/**
 * Keep every Admin and recovery request on one configured origin. PKCE
 * verifiers are first-party cookies and cannot be exchanged on a different
 * Vercel deployment hostname.
 */
export function getCanonicalAdminUrl(
  requestUrl: URL,
  configuredSiteUrl: string,
  requestOrigin = requestUrl.origin,
) {
  if (!isAdminOrAuthCallback(requestUrl.pathname)) return null;

  const canonicalOrigin = new URL(configuredSiteUrl).origin;
  if (new URL(requestOrigin).origin === canonicalOrigin) return null;

  return new URL(`${requestUrl.pathname}${requestUrl.search}`, canonicalOrigin);
}

export function readForwardedRequestOrigin(
  requestUrl: URL,
  headers: Pick<Headers, "get">,
) {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headers.get("host")?.trim();
  if (!host) return requestUrl.origin;

  const forwardedProtocol = headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : requestUrl.protocol.replace(":", "");

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return requestUrl.origin;
  }
}
