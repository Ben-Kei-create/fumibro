import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicPost } from "@/modules/public-content/application/get-public-content";
import {
  AdSlot,
  SafeRichText,
  formatPublicDate,
} from "@/modules/public-content/ui/public-content";

export async function generateMetadata(
  props: PageProps<"/blog/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPublicPost(slug);
  if (!post) return { title: "投稿が見つかりません" };
  return {
    description: post.excerpt ?? post.body.slice(0, 160),
    title: post.title ?? "無題の投稿",
  };
}

export default async function BlogDetailPage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const post = await getPublicPost(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <article>
        <header>
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
            <time dateTime={post.publishAt}>
              {formatPublicDate(post.publishAt)}
            </time>
            {post.feedEventType ? (
              <span className="rounded-full bg-stone-900 px-2.5 py-1 text-xs font-bold text-white">
                {post.feedEventType.toUpperCase()}
              </span>
            ) : null}
            {post.project ? (
              <Link href={`/projects/${post.project.slug}`}>
                {post.project.name}
              </Link>
            ) : null}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-950 sm:text-5xl">
            {post.title ?? "無題の投稿"}
          </h1>
          {post.excerpt ? (
            <p className="mt-5 text-lg leading-8 text-stone-600">
              {post.excerpt}
            </p>
          ) : null}
        </header>

        {post.image ? (
          <Image
            alt={post.image.altText}
            className="mt-8 h-auto w-full rounded-2xl object-cover"
            height={post.image.height}
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            src={post.image.url}
            width={post.image.width}
          />
        ) : null}

        {post.isSpoiler ? (
          <details className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <summary className="cursor-pointer font-semibold text-amber-950">
              ネタバレを含みます
            </summary>
            <div className="mt-5">
              <SafeRichText value={post.body} />
            </div>
          </details>
        ) : (
          <div className="mt-8">
            <SafeRichText value={post.body} />
          </div>
        )}

        <dl className="mt-10 grid gap-3 border-t border-stone-200 pt-6 text-sm sm:grid-cols-2">
          {post.category ? (
            <div>
              <dt className="font-semibold text-stone-500">ジャンル</dt>
              <dd className="mt-1">
                <Link href={`/blog/categories/${post.category.slug}`}>
                  {post.category.label}
                </Link>
              </dd>
            </div>
          ) : null}
          {post.location ? (
            <div>
              <dt className="font-semibold text-stone-500">場所</dt>
              <dd className="mt-1">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location.mapsQuery)}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {post.location.displayName} ↗
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        {post.tags.length ? (
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-stone-600">
            {post.tags.map((tag) => (
              <Link href={`/tags/${tag.slug}`} key={tag.slug}>
                #{tag.label}
              </Link>
            ))}
          </div>
        ) : null}
        {post.externalUrl ? (
          <a
            className="button-secondary mt-7"
            href={post.externalUrl}
            rel="noreferrer"
            target="_blank"
          >
            関連リンクを開く ↗
          </a>
        ) : null}
      </article>

      <div className="mt-12">
        <AdSlot />
      </div>
      <section className="mt-10 border-t border-stone-200 pt-8">
        <h2 className="text-xl font-bold">コメント・👍</h2>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          コメントと👍は現在準備中です。
        </p>
      </section>
    </main>
  );
}
