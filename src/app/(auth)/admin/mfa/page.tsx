import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/modules/auth/application/actions";
import { readAdminSession } from "@/modules/auth/application/require-admin";
import { sanitizeAdminNextPath } from "@/modules/auth/domain/admin-navigation";
import { MfaForm } from "@/modules/auth/ui/mfa-form";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Admin MFA",
};

type MfaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminMfaPage({ searchParams }: MfaPageProps) {
  const parameters = await searchParams;
  const nextPath = sanitizeAdminNextPath(parameters.next);
  const { state } = await readAdminSession();

  if (state === "signed_out") {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (state === "authorized") {
    redirect(nextPath);
  }

  if (state === "forbidden") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
        <section className="w-full rounded-2xl border border-stone-200 bg-white p-6">
          <h1 className="text-xl font-bold">Admin権限を確認できません</h1>
          <form action={logoutAction} className="mt-6">
            <button className="button-secondary w-full" type="submit">
              ログアウト
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500">
          SECOND FACTOR
        </p>
        <h1 className="mt-3 text-2xl font-bold text-stone-950">2段階認証</h1>
        <p className="mt-2 mb-7 text-sm leading-6 text-stone-600">
          AAL2になったログインセッションは、Quick投稿のたびに再入力する必要はありません。
        </p>
        <MfaForm nextPath={nextPath} />
        <form action={logoutAction} className="mt-5">
          <button
            className="w-full text-sm text-stone-600 underline"
            type="submit"
          >
            ログアウト
          </button>
        </form>
      </section>
    </main>
  );
}
