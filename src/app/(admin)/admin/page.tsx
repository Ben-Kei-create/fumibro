import Link from "next/link";

import { getAdminDashboardSummary } from "@/modules/admin/application/get-dashboard-summary";

export const dynamic = "force-dynamic";

const managementLinks = [
  { href: "/admin/quick", label: "Quick投稿", note: "スマホから短文を投稿" },
  {
    href: "/admin/content",
    label: "Content",
    note: "Blog・Works・Library・Pages",
  },
  { href: "/admin/projects", label: "Projects", note: "分類とテーマ設定" },
  { href: "/admin/media", label: "Media", note: "画像・ファイル管理" },
  { href: "/admin/exports", label: "Export", note: "CSV・JSON" },
  { href: "/admin/settings", label: "Settings", note: "サイト・名刺・タグ" },
];

export default async function AdminDashboardPage() {
  const summary = await getAdminDashboardSummary();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-500">OVERVIEW</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">Dashboard</h1>
        </div>
        <Link className="button-primary" href="/admin/quick">
          Quick投稿
        </Link>
      </div>

      <section aria-labelledby="notifications" className="mt-8">
        <h2 className="text-lg font-bold" id="notifications">
          未処理
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Link
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400"
            href="/admin/inquiries?status=new"
          >
            <p className="text-sm text-stone-600">新着問い合わせ</p>
            <p className="mt-2 text-3xl font-bold text-stone-950">
              {summary.newInquiryCount}
            </p>
          </Link>
          <Link
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400"
            href="/admin/comments?status=pending"
          >
            <p className="text-sm text-stone-600">承認待ちコメント</p>
            <p className="mt-2 text-3xl font-bold text-stone-950">
              {summary.pendingCommentCount}
            </p>
          </Link>
        </div>
        {summary.hasError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            未処理件数を取得できませんでした。Supabase接続を確認してください。
          </p>
        ) : null}
      </section>

      <section aria-labelledby="management" className="mt-10">
        <h2 className="text-lg font-bold" id="management">
          管理
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {managementLinks.map((item) => (
            <Link
              className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
              href={item.href}
              key={item.href}
            >
              <p className="font-semibold text-stone-950">{item.label}</p>
              <p className="mt-1 text-sm text-stone-600">{item.note}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
