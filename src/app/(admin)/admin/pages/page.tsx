import Link from "next/link";

import { getAdminContentList } from "@/modules/content-admin/application/admin-public-content";

export default async function AdminPagesPage() {
  const pages = await getAdminContentList("page");
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">SYSTEM PAGES</p>
      <h1 className="mt-1 text-3xl font-bold">Pages</h1>
      <p className="mt-3 text-stone-600">
        AboutとPrivacyを編集します。保存前の状態はRevisionへ残ります。
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {pages.map((page) => (
          <Link
            className="rounded-xl border border-stone-200 bg-white p-5"
            href={`/admin/pages/${page.id}/edit`}
            key={page.id}
          >
            <p className="font-bold">{page.title}</p>
            <p className="mt-2 text-sm text-stone-600">
              /{page.slug} · {page.status}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
