import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getProjectContent,
  getPublicProject,
} from "@/modules/public-content/application/get-public-content";
import {
  AdSlot,
  ContentSummaryCard,
  EmptyState,
  PageHeading,
} from "@/modules/public-content/ui/public-content";
import { getProjectTheme } from "@/themes/registry";

export async function generateMetadata(
  props: PageProps<"/projects/[projectSlug]">,
): Promise<Metadata> {
  const { projectSlug } = await props.params;
  const project = await getPublicProject(projectSlug);
  if (!project) return { title: "Projectが見つかりません" };
  return { description: project.description, title: project.name };
}

export default async function ProjectDetailPage(
  props: PageProps<"/projects/[projectSlug]">,
) {
  const { projectSlug } = await props.params;
  const project = await getPublicProject(projectSlug);
  if (!project) notFound();
  const [items, theme] = await Promise.all([
    getProjectContent(project.id),
    Promise.resolve(getProjectTheme(project.themeKey)),
  ]);

  return (
    <main
      className={`mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14 ${theme.containerClassName}`}
      data-project-theme={theme.key}
    >
      <PageHeading
        description={project.description ?? undefined}
        eyebrow="FUMIBRO PROJECT"
        title={project.name}
      />
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href={`/projects/${project.slug}/feed.xml`}>RSS</Link>
        <Link href="/projects">すべてのProjects</Link>
      </div>
      <div className="mt-10 space-y-4">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.id}>
              <ContentSummaryCard item={item} />
              {index === 3 ? (
                <div className="mt-5">
                  <AdSlot />
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState>このProjectの公開コンテンツはまだありません。</EmptyState>
        )}
      </div>
    </main>
  );
}
