import "server-only";

import { readAdminSession } from "@/modules/auth/application/require-admin";
import { readSubject } from "@/modules/auth/domain/admin-session";

export class AdminApiAuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiAuthorizationError";
  }
}

export async function requireAdminApi() {
  const { claims, state, supabase } = await readAdminSession();

  if (state === "signed_out" || !claims) {
    throw new AdminApiAuthorizationError(401, "Authentication required.");
  }

  if (state !== "authorized") {
    throw new AdminApiAuthorizationError(403, "AAL2 administrator required.");
  }

  return { claims, supabase, userId: readSubject(claims) };
}
