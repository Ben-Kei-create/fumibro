"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    if (typeof email !== "string") return;

    setSubmitting(true);
    setUnavailable(false);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/admin/update-password`,
    });

    if (error) {
      setUnavailable(true);
      setSubmitting(false);
      return;
    }

    // The browser client stores the PKCE verifier on this same canonical
    // origin before Supabase sends the email.
    router.replace("/admin/forgot-password?sent=1");
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium text-stone-800" htmlFor="email">
          メールアドレス
        </label>
        <input
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
          id="email"
          maxLength={254}
          name="email"
          required
          type="email"
        />
      </div>
      {unavailable ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          現在メールを送信できません。しばらく待ってから再試行してください。
        </p>
      ) : null}
      <button
        className="button-primary w-full"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "送信中…" : "再設定メールを送る"}
      </button>
    </form>
  );
}
