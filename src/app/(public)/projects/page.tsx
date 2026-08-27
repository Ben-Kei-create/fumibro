import type { Metadata } from "next";
import Link from "next/link";

import { getPublicProjects } from "@/modules/public-content/application/get-public-content";
import {
  EmptyState,
  PageHeading,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "FUMIBROで運営するProject一覧。",
  title: "Projects",
};

export default async function ProjectsPage() {
  const projects = await getPublicProjects();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description="教育、出版、映画、怪談、App。すべて同じCMSを使いながら、それぞれのProjectとして育てています。"
        eyebrow="PROJECT HUB"
        title="Projects"
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.length ? (
          projects.map((project) => (
            <article
              className="flex min-h-56 flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
              key={project.id}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Project
              </p>
              <h2 className="mt-3 text-2xl font-bold text-stone-950">
                {project.name}
              </h2>
              <p className="mt-3 flex-1 leading-7 text-stone-600">
                {project.description ?? "FUMIBRO Project"}
              </p>
              <Link
                className="mt-5 text-sm font-semibold"
                href={`/projects/${project.slug}`}
              >
                Projectを見る →
              </Link>
            </article>
          ))
        ) : (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState>公開中のProjectはありません。</EmptyState>
          </div>
        )}
      </div>
    </main>
  );
}
