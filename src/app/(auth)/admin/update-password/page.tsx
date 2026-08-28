import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/modules/auth/ui/update-password-form";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Set New Admin Password",
};

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const params = await searchParams;
  const recoveryCode = Array.isArray(params.code)
    ? params.code[0]
    : params.code;

  // Older reset emails can target this page directly with a PKCE code. Route
  // them through the callback handler so the code is exchanged server-side and
  // the session cookies are set before the password form is rendered.
  if (recoveryCode) {
    const callbackParams = new URLSearchParams({
      code: recoveryCode,
      next: "/admin/update-password",
    });
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  return <UpdatePasswordForm />;
}
