import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/modules/auth/ui/update-password-form";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Set New Admin Password",
};

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string | string[];
    error?: string | string[];
    sb_flow_id?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const recoveryCode = Array.isArray(params.code)
    ? params.code[0]
    : params.code;
  const flowId = Array.isArray(params.sb_flow_id)
    ? params.sb_flow_id[0]
    : params.sb_flow_id;
  const tokenHash = Array.isArray(params.token_hash)
    ? params.token_hash[0]
    : params.token_hash;
  const recoveryType = Array.isArray(params.type)
    ? params.type[0]
    : params.type;

  // Older emails may target this page directly. Consume every one-time
  // credential at the server endpoint before rendering the password form.
  if (recoveryCode || tokenHash || recoveryType) {
    const callbackParams = new URLSearchParams();
    if (recoveryCode) callbackParams.set("code", recoveryCode);
    if (flowId) {
      callbackParams.set("sb_flow_id", flowId);
    }
    if (tokenHash) callbackParams.set("token_hash", tokenHash);
    if (recoveryType) callbackParams.set("type", recoveryType);
    redirect(`/auth/confirm?${callbackParams.toString()}`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.app_metadata.role !== "admin") {
    redirect("/admin/forgot-password?error=invalid_link");
  }

  const errorCode = Array.isArray(params.error)
    ? params.error[0]
    : params.error;
  return <UpdatePasswordForm errorCode={errorCode} />;
}
