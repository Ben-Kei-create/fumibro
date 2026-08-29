import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminRecoveryCredential } from "@/modules/auth/domain/recovery-confirmation";

/**
 * Consume a one-time recovery credential and retain only an Admin session.
 * Authorization continues to rely on trusted app_metadata.
 */
export async function establishAdminRecoverySession(
  credential: AdminRecoveryCredential,
) {
  const supabase = await createServerSupabaseClient();
  const { error } =
    credential.kind === "token_hash"
      ? await supabase.auth.verifyOtp({
          token_hash: credential.tokenHash,
          type: "recovery",
        })
      : await supabase.auth.exchangeCodeForSession(
          credential.code,
          credential.flowId ? { flowId: credential.flowId } : undefined,
        );

  if (error) return false;

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || data.user?.app_metadata.role !== "admin") {
    await supabase.auth.signOut({ scope: "local" });
    return false;
  }

  return true;
}
