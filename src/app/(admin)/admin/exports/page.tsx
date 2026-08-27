import Link from "next/link";

import { requireAdmin } from "@/modules/auth/application/require-admin";

const datasets = [
  ["Blog", "blog", "投稿本文・ジャンル・場所・タグを含みます。"],
  ["Library", "library", "Access policyと配布設定を含みます。"],
  ["Works", "works", "作品情報とPortfolio/Home表示設定を含みます。"],
  ["Portfolio", "portfolio", "Portfolioへ掲載しているWorksだけを出力します。"],
  ["Projects master", "projects", "Project名・slug・theme keyを出力します。"],
] as const;

function ExportLinks({ href }: { href: string }) {
  const separator = href.includes("?") ? "&" : "?";
  return (
    <div className="flex gap-2">
      <Link
        className="button-secondary"
        href={`${href}${separator}format=csv`}
        prefetch={false}
      >
        CSV
      </Link>
      <Link
        className="button-secondary"
        href={`${href}${separator}format=json`}
        prefetch={false}
      >
        JSON
      </Link>
    </div>
  );
}

export default async function AdminExportsPage() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/exports" });
  const projects = await supabase
    .from("projects")
    .select("id,name,slug")
    .is("deleted_at", null)
    .order("display_order");

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">PORTABLE DATA</p>
      <h1 className="mt-1 text-3xl font-bold">Export</h1>
      <p className="mt-3 text-sm leading-7 text-stone-600">
        AAL2の管理者セッションだけが利用できます。CSVは表計算ソフトの数式実行を防止し、JSONにはschemaVersionを含めます。
      </p>
      <section className="mt-8 space-y-3" aria-labelledby="datasets">
        <h2 className="text-xl font-bold" id="datasets">
          全体データ
        </h2>
        {datasets.map(([label, dataset, note]) => (
          <div
            className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center"
            key={dataset}
          >
            <div>
              <h3 className="font-semibold">{label}</h3>
              <p className="mt-1 text-sm text-stone-600">{note}</p>
            </div>
            <ExportLinks href={`/api/admin/exports/${dataset}`} />
          </div>
        ))}
      </section>
      <section className="mt-10 space-y-3" aria-labelledby="projects">
        <h2 className="text-xl font-bold" id="projects">
          Project別コンテンツ
        </h2>
        {(projects.data ?? []).map((project) => (
          <div
            className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center"
            key={project.id}
          >
            <div>
              <h3 className="font-semibold">{project.name}</h3>
              <p className="mt-1 font-mono text-xs text-stone-500">
                {project.slug}
              </p>
            </div>
            <ExportLinks
              href={`/api/admin/exports/project?projectId=${encodeURIComponent(project.id)}`}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
