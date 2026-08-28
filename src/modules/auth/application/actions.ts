"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getPublicEnvironment } from "@/lib/env/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeAdminNextPath } from "@/modules/auth/domain/admin-navigation";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
  next: z.string().optional(),
});

const passwordResetSchema = z.object({
  email: z.string().trim().email().max(254),
});

function loginErrorUrl(code: "invalid" | "unauthorized") {
  const params = new URLSearchParams({ error: code });
  return `/admin/login?${params.toString()}`;
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    redirect(loginErrorUrl("invalid"));
  }

  const nextPath = sanitizeAdminNextPath(parsed.data.next);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || data.user.app_metadata.role !== "admin") {
    if (data.session) {
      await supabase.auth.signOut({ scope: "local" });
    }
    redirect(loginErrorUrl(error ? "invalid" : "unauthorized"));
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError || assurance.currentLevel !== "aal2") {
    redirect(`/admin/mfa?next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}

/**
 * Request a recovery email without revealing whether an address is registered.
 * The redirect target is the configured site URL; it must be allow-listed in
 * Supabase Auth URL Configuration before enabling this flow in production.
 */
export async function requestPasswordResetAction(formData: FormData) {
  const parsed = passwordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect("/admin/forgot-password?error=invalid_email");
  }

  const supabase = await createServerSupabaseClient();
  const siteUrl = getPublicEnvironment().NEXT_PUBLIC_SITE_URL.replace(
    /\/$/,
    "",
  );
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/admin/update-password`,
  });

  // Always show the same result for valid-looking addresses to avoid account
  // enumeration through the public reset form.
  redirect("/admin/forgot-password?sent=1");
}
