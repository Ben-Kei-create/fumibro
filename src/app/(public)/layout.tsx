import Link from "next/link";

import { getVisitTotal } from "@/modules/public-content/application/get-public-content";
import { VisitorCounter } from "@/modules/visitors/ui/visitor-counter";

// Public CMS content must reflect Admin changes without requiring a redeploy.
export const dynamic = "force-dynamic";

const navigation = [
  ["Blog", "/blog"],
  ["Projects", "/projects"],
  ["Library", "/library"],
  ["Works", "/works"],
  ["Portfolio", "/portfolio"],
  ["About", "/about"],
  ["Search", "/search"],
] as const;

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const visitTotal = await getVisitTotal();
  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <Link
            className="text-xl font-black tracking-[0.12em] text-stone-950"
            href="/"
          >
            FUMIBRO
          </Link>
          <nav aria-label="メインナビゲーション">
            <ul className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-stone-700">
              {navigation.map(([label, href]) => (
                <li key={href}>
                  <Link className="hover:text-stone-950" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <div className="min-h-[65vh] flex-1">{children}</div>
      <footer className="mt-16 border-t border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © FUMIBRO · VISITORS <VisitorCounter initialTotal={visitTotal} />
          </p>
          <nav aria-label="フッターナビゲーション">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/feed.xml">RSS</Link>
              </li>
              <li>
                <Link href="/admin/login">Admin</Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
