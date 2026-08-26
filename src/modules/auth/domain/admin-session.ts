export type AdminSessionState =
  "signed_out" | "forbidden" | "mfa_required" | "authorized";

type ClaimsRecord = Record<string, unknown>;

function readRecord(value: unknown): ClaimsRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as ClaimsRecord;
}

export function getAdminSessionState(
  claims: ClaimsRecord | null | undefined,
): AdminSessionState {
  if (!claims || typeof claims.sub !== "string" || claims.sub.length === 0) {
    return "signed_out";
  }

  const appMetadata = readRecord(claims.app_metadata);
  const isAnonymous =
    claims.is_anonymous === true || claims.is_anonymous === "true";

  if (isAnonymous || appMetadata?.role !== "admin") {
    return "forbidden";
  }

  return claims.aal === "aal2" ? "authorized" : "mfa_required";
}

export function readSubject(claims: ClaimsRecord): string {
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("Authenticated claims do not contain a subject.");
  }

  return claims.sub;
}
