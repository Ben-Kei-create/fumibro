const ADMIN_ROOT = "/admin";
const ADMIN_ORIGIN = "https://fumibro.invalid";
const AUTHENTICATION_PATHS = new Set(["/admin/login", "/admin/mfa"]);

export function sanitizeAdminNextPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.includes("\\")
  ) {
    return ADMIN_ROOT;
  }

  try {
    const target = new URL(value, ADMIN_ORIGIN);
    const isAdminPath =
      target.pathname === ADMIN_ROOT ||
      target.pathname.startsWith(`${ADMIN_ROOT}/`);

    if (
      target.origin !== ADMIN_ORIGIN ||
      !isAdminPath ||
      AUTHENTICATION_PATHS.has(target.pathname)
    ) {
      return ADMIN_ROOT;
    }

    return `${target.pathname}${target.search}`;
  } catch {
    return ADMIN_ROOT;
  }
}
