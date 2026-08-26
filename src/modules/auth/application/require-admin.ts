import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getAdminSessionState,
  readSubject,
} from "@/modules/auth/domain/admin-session";

type RequireAdminOptions = {
  nextPath?: string;
};

const verifyAdminSession = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const state = error ? "signed_out" : getAdminSessionState(claims);

  return { claims, state, supabase };
});

export async function requireAdmin(options: RequireAdminOptions = {}) {
  const { claims, state, supabase } = await verifyAdminSession();
  const nextPath = options.nextPath ?? "/admin";

  if (state === "signed_out") {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (state === "mfa_required") {
    redirect(`/admin/mfa?next=${encodeURIComponent(nextPath)}`);
  }

  if (state === "forbidden" || !claims) {
    redirect("/admin/login?error=unauthorized");
  }

  return {
    claims,
    supabase,
    userId: readSubject(claims),
  };
}

export async function readAdminSession() {
  return verifyAdminSession();
}
