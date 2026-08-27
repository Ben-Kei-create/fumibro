import type { Metadata } from "next";
import Link from "next/link";

import { getAdminDashboardSummary } from "@/modules/admin/application/get-dashboard-summary";
import { logoutAction } from "@/modules/auth/application/actions";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: {
    default: "Admin",
    template: "%s | FUMIBRO Admin",
  },
};

const navigation = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/quick", label: "Quick投稿" },
  { href: "/admin/posts", label: "Blog" },
  { href: "/admin/works", label: "Works" },
  { href: "/admin/library", label: "Library" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/notices", label: "掲示板" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/trash", label: "Trash" },
  { href: "/admin/settings", label: "設定" },
];

function formatNotificationCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const summary = await getAdminDashboardSummary();
  const notifications = [
    {
      count: summary.pendingCommentCount,
      href: "/admin/comments?status=pending",
      label: "コメント",
      meaning: "承認待ちコメント",
    },
    {
      count: summary.newInquiryCount,
      href: "/admin/inquiries?status=new",
      label: "問い合わせ",
      meaning: "新着問い合わせ",
    },
  ];

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <Link
            className="mr-auto font-bold tracking-wide text-stone-950"
            href="/admin"
          >
            FUMIBRO Admin
          </Link>
          <Link
            className="text-sm text-stone-600 hover:text-stone-950"
            href="/"
          >
            公開サイト
          </Link>
          <form action={logoutAction}>
            <button className="text-sm text-stone-600 underline" type="submit">
              ログアウト
            </button>
          </form>
        </div>
        <nav
          aria-label="Admin"
          className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6"
        >
          <ul className="flex min-w-max gap-1 pb-3">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {notifications.map((item) => (
              <li key={item.href}>
                <Link
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                  href={item.href}
                >
                  {item.label}
                  <span
                    aria-label={`${item.meaning} ${item.count}件`}
                    className="inline-flex min-w-6 justify-center rounded-full bg-stone-900 px-1.5 py-0.5 text-xs font-bold text-white"
                  >
                    {formatNotificationCount(item.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
