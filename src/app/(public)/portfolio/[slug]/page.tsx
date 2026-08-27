import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicWork } from "@/modules/public-content/application/get-public-content";
import { SafeRichText } from "@/modules/public-content/ui/public-content";

export async function generateMetadata(
  props: PageProps<"/portfolio/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const work = await getPublicWork(slug);
  if (!work?.showInPortfolio) return { title: "作品が見つかりません" };
  return {
    alternates: { canonical: `/works/${work.slug}` },
    description: work.summary ?? work.excerpt,
    title: work.title,
  };
}

export default async function PortfolioDetailPage(
  props: PageProps<"/portfolio/[slug]">,
) {
  const { slug } = await props.params;
  const work = await getPublicWork(slug);
  if (!work?.showInPortfolio) notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      <article className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {work.image ? (
            <Image
              alt={work.image.altText}
              className="h-auto w-full rounded-2xl"
              height={work.image.height}
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              src={work.image.url}
              width={work.image.width}
            />
          ) : (
            <div className="aspect-[4/3] rounded-2xl bg-stone-200" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            {work.project?.name ?? work.type}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">
            {work.title}
          </h1>
          {work.summary ? (
            <p className="mt-5 text-lg leading-8 text-stone-600">
              {work.summary}
            </p>
          ) : null}
          <div className="mt-8">
            <SafeRichText value={work.description} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {work.externalUrl ? (
              <a
                className="button-primary"
                href={work.externalUrl}
                rel="noreferrer"
                target="_blank"
              >
                作品を見る ↗
              </a>
            ) : null}
            <Link className="button-secondary" href={`/works/${work.slug}`}>
              Worksで見る
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
