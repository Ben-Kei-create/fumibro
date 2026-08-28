import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/modules/auth/application/actions";
import { readAdminSession } from "@/modules/auth/application/require-admin";
import { sanitizeAdminNextPath } from "@/modules/auth/domain/admin-navigation";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Admin Login",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const parameters = await searchParams;
  const nextPath = sanitizeAdminNextPath(parameters.next);
  const { state } = await readAdminSession();

  if (state === "authorized") {
    redirect(nextPath);
  }

  if (state === "mfa_required") {
    redirect(`/admin/mfa?next=${encodeURIComponent(nextPath)}`);
  }

  const errorCode =
    typeof parameters.error === "string" ? parameters.error : null;
  const errorMessage =
    errorCode === "unauthorized"
      ? "このアカウントにはAdmin権限がありません。"
      : errorCode
        ? "メールアドレスまたはパスワードを確認してください。"
        : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500">
          FUMIBRO ADMIN
        </p>
        <h1 className="mt-3 text-2xl font-bold text-stone-950">
          管理者ログイン
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          管理者本人のメールアドレスとパスワードを入力してください。
        </p>

        <form action={loginAction} className="mt-7 space-y-5">
          <input name="next" type="hidden" value={nextPath} />
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="email"
            >
              メールアドレス
            </label>
            <input
              autoComplete="username"
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
              id="email"
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="password"
            >
              パスワード
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>
          {errorMessage ? (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
          <button className="button-primary w-full" type="submit">
            ログイン
          </button>
        </form>

        <Link
          className="mt-6 inline-block text-sm text-stone-600 underline"
          href="/"
        >
          公開サイトへ戻る
        </Link>
        <Link
          className="mt-3 inline-block text-sm text-stone-600 underline"
          href="/admin/forgot-password"
        >
          パスワードを忘れた場合
        </Link>
      </section>
    </main>
  );
}
