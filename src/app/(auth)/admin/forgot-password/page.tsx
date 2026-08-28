import type { Metadata } from "next";
import Link from "next/link";

import { requestPasswordResetAction } from "@/modules/auth/application/actions";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Reset Admin Password",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const parameters = await searchParams;
  const sent = parameters.sent === "1";
  const invalidEmail = parameters.error === "invalid_email";
  const invalidLink = parameters.error === "invalid_link";
  const unavailable = parameters.error === "unavailable";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500">
          FUMIBRO ADMIN
        </p>
        <h1 className="mt-3 text-2xl font-bold text-stone-950">
          パスワードを再設定
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          登録メールアドレスへ再設定用リンクを送ります。メールアドレスの登録有無は表示しません。
        </p>

        {sent ? (
          <p
            className="mt-6 rounded-lg bg-stone-100 p-3 text-sm text-stone-800"
            role="status"
          >
            該当する場合は、再設定用リンクをメールで確認してください。
          </p>
        ) : (
          <form action={requestPasswordResetAction} className="mt-7 space-y-5">
            <div>
              <label
                className="text-sm font-medium text-stone-800"
                htmlFor="email"
              >
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
            {invalidLink ? (
              <p
                className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                リセットリンクが無効または期限切れです。同じブラウザで再設定メールを再取得してください。
              </p>
            ) : null}
            {invalidEmail ? (
              <p
                className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                メールアドレスを確認してください。
              </p>
            ) : null}
            {unavailable ? (
              <p
                className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                現在メールを送信できません。しばらく待ってから再試行してください。
              </p>
            ) : null}
            <button className="button-primary w-full" type="submit">
              再設定メールを送る
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
