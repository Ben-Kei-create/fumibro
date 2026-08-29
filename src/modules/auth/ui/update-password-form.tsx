import Link from "next/link";

import { updatePasswordAction } from "@/modules/auth/application/actions";

type UpdatePasswordFormProps = {
  errorCode?: string | null;
};

export function UpdatePasswordForm({ errorCode }: UpdatePasswordFormProps) {
  const error =
    errorCode === "invalid_password"
      ? "12文字以上の同じパスワードを2回入力してください。"
      : errorCode === "update_failed"
        ? "パスワードを更新できませんでした。新しいRecoveryメールを取得してください。"
        : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500">
          FUMIBRO ADMIN
        </p>
        <h1 className="mt-3 text-2xl font-bold text-stone-950">
          新しいパスワード
        </h1>
        <form action={updatePasswordAction} className="mt-7 space-y-5">
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
              name="password"
              required
              type="password"
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
              name="confirmation"
              required
              type="password"
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
          <button className="button-primary w-full" type="submit">
            パスワードを更新
          </button>
        </form>
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
