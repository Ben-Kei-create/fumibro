const MAX_AUTH_CREDENTIAL_LENGTH = 4096;

export const ADMIN_UPDATE_PASSWORD_PATH = "/admin/update-password";

export type AdminRecoveryCredential =
  | {
      kind: "token_hash";
      tokenHash: string;
    }
  | {
      code: string;
      flowId?: string;
      kind: "pkce";
    };

function readCredential(value: string | null) {
  if (!value || value.length > MAX_AUTH_CREDENTIAL_LENGTH) return null;
  return value;
}

/**
 * Prefer the SSR token-hash flow. PKCE remains only for already-issued links
 * and Free projects whose built-in SMTP template cannot yet be customized.
 */
export function readAdminRecoveryCredential(
  searchParams: URLSearchParams,
): AdminRecoveryCredential | null {
  const tokenHash = readCredential(searchParams.get("token_hash"));
  const type = searchParams.get("type");

  if (tokenHash || type) {
    return tokenHash && type === "recovery"
      ? { kind: "token_hash", tokenHash }
      : null;
  }

  const code = readCredential(searchParams.get("code"));
  if (!code) return null;

  const flowId = readCredential(searchParams.get("sb_flow_id"));
  return flowId ? { code, flowId, kind: "pkce" } : { code, kind: "pkce" };
}
