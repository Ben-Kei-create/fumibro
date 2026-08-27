import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicWork } from "@/modules/public-content/application/get-public-content";
import {
  AdSlot,
  SafeRichText,
  formatPublicDate,
} from "@/modules/public-content/ui/public-content";

export async function generateMetadata(
  props: PageProps<"/works/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const work = await getPublicWork(slug);
  if (!work) return { title: "作品が見つかりません" };
  return { description: work.summary ?? work.excerpt, title: work.title };
}

export default async function WorkDetailPage(
  props: PageProps<"/works/[slug]">,
) {
  const { slug } = await props.params;
  const work = await getPublicWork(slug);
  if (!work) notFound();
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <article>
        <header className="max-w-3xl">
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
        </header>
        {work.image ? (
          <Image
            alt={work.image.altText}
            className="mt-8 h-auto w-full rounded-2xl"
            height={work.image.height}
            priority
            sizes="(max-width: 896px) 100vw, 896px"
            src={work.image.url}
            width={work.image.width}
          />
        ) : null}
        <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-stone-600">
          <div>
            <dt className="font-semibold">公開</dt>
            <dd>{formatPublicDate(work.publishedAt)}</dd>
          </div>
          {work.releasedOn ? (
            <div>
              <dt className="font-semibold">制作日</dt>
              <dd>{work.releasedOn}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-9">
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
          {work.project ? (
            <Link
              className="button-secondary"
              href={`/projects/${work.project.slug}`}
            >
              {work.project.name}
            </Link>
          ) : null}
        </div>
      </article>
      <div className="mt-12">
        <AdSlot />
      </div>
    </main>
  );
}
