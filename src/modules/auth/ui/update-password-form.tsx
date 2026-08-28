"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function UpdatePasswordForm() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setReady(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && (event === "PASSWORD_RECOVERY" || session)) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 12) {
      setError("パスワードは12文字以上で設定してください。");
      return;
    }
    if (password !== confirmation) {
      setError("パスワードが一致しません。");
      return;
    }

    const { error: updateError } =
      await createBrowserSupabaseClient().auth.updateUser({
        password,
      });
    if (updateError) {
      setError(
        "パスワードを更新できませんでした。リンクを再取得してください。",
      );
      return;
    }

    await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
    setPassword("");
    setConfirmation("");
    setMessage(
      "パスワードを更新しました。ログイン画面からログインしてください。",
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500">
          FUMIBRO ADMIN
        </p>
        <h1 className="mt-3 text-2xl font-bold text-stone-950">
          新しいパスワード
        </h1>
        {!ready ? (
          <p className="mt-4 text-sm text-stone-600">
            再設定リンクを確認しています。
          </p>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                className="text-sm font-medium text-stone-800"
                htmlFor="new-password"
              >
                新しいパスワード
              </label>
              <input
                autoComplete="new-password"
                className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
                id="new-password"
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div>
              <label
                className="text-sm font-medium text-stone-800"
                htmlFor="confirm-password"
              >
                新しいパスワード（確認）
              </label>
              <input
                autoComplete="new-password"
                className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
                id="confirm-password"
                minLength={12}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </div>
            {error ? (
              <p
                className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {message ? (
              <p
                className="rounded-lg bg-stone-100 p-3 text-sm text-stone-800"
                role="status"
              >
                {message}
              </p>
            ) : null}
            <button className="button-primary w-full" type="submit">
              パスワードを更新
            </button>
          </form>
        )}
        <Link
          className="mt-6 inline-block text-sm text-stone-600 underline"
          href="/admin/login"
        >
          ログインへ戻る
        </Link>
      </section>
    </main>
  );
}
