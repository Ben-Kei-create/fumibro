"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeAdminNextPath } from "@/modules/auth/domain/admin-navigation";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
  next: z.string().optional(),
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
