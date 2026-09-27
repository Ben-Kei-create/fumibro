import { Cat, ExternalLink, Search } from "lucide-react";
import Link from "next/link";

import type {
  PublicPostDto,
  PublicTagDto,
} from "@/modules/public-content/application/public-content-dto";
import {
  AdSlot,
  EmptyState,
  formatPublicDate,
  PublicImage,
} from "@/modules/public-content/ui/public-content";

type BlogIndexProps = {
  categories: PublicTagDto[];
  posts: PublicPostDto[];
};

function BlogPostCard({ post }: { post: PublicPostDto }) {
  const title = post.title ?? "無題の投稿";
  const section = post.project?.name ?? post.category?.label ?? "FUMIBRO";

  return (
    <article className="group h-full overflow-hidden rounded-2xl bg-[#202a31] text-white shadow-[0_18px_45px_-30px_rgba(28,25,23,0.9)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_52px_-28px_rgba(28,25,23,0.95)]">
      <Link
        aria-label={`${title}の記事詳細を読む`}
        className="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-950"
        href={`/blog/${post.slug}`}
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-stone-900">
          {post.image ? (
            <PublicImage image={post.image} />
          ) : (
            <div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_top_right,#57534e_0,transparent_45%),linear-gradient(145deg,#292524,#0c0a09)] p-5">
              <div className="flex items-center justify-between text-[0.65rem] font-bold tracking-[0.2em] text-stone-400">
                <span>FUMIBRO JOURNAL</span>
                <Cat aria-hidden="true" className="size-6" />
              </div>
              <p className="line-clamp-2 text-xl font-bold leading-snug text-stone-100">
                {title}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold text-stone-400">
            <span>{section}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishAt}>
              {formatPublicDate(post.publishAt)}
            </time>
            {post.feedEventType ? (
              <span className="rounded-full border border-stone-500 px-2 py-0.5 text-[0.6rem] tracking-[0.08em] text-stone-200">
                {post.feedEventType.toUpperCase()}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 line-clamp-3 text-xl font-bold leading-snug tracking-tight text-white">
            {title}
          </h2>
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-300">
            {post.excerpt ?? post.body}
          </p>
          {post.tags.length ? (
            <p className="mt-auto pt-5 text-xs text-stone-400">
              {post.tags
                .slice(0, 3)
                .map((tag) => `#${tag.label}`)
                .join("  ")}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export function BlogIndex({ categories, posts }: BlogIndexProps) {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-6 sm:px-8 sm:pb-28 sm:pt-10">
      <header className="grid overflow-hidden rounded-[2rem] border border-stone-300 bg-white lg:grid-cols-[1.35fr_0.65fr]">
        <div className="flex min-h-[25rem] flex-col justify-between bg-[#e8e4dc] p-7 sm:p-10 lg:p-14">
          <p className="text-xs font-bold tracking-[0.24em] text-stone-600">
            FUMIBRO&apos;S CENTER
          </p>
          <div className="py-14">
            <h1 className="text-6xl font-black tracking-[-0.055em] text-stone-950 sm:text-8xl">
              Blog
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-stone-700 sm:text-lg">
              日常、制作、映画、出版、教材、App。
              <br className="hidden sm:block" />
              短いメモも長い文章も、ひとつの時間軸に記録します。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              className="inline-flex w-fit items-center gap-2 text-sm font-bold text-stone-950"
              href="/search"
            >
              <Search aria-hidden="true" className="size-4" />
              Blogを検索
            </Link>
            <Link
              className="inline-flex w-fit items-center gap-2 text-sm font-bold text-stone-950 underline decoration-stone-400 underline-offset-4 transition hover:decoration-stone-950"
              href="https://note.com/benkein"
              rel="noopener noreferrer"
              target="_blank"
            >
              noteも読む
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only">（外部サイト・新しいタブ）</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-center divide-y divide-stone-300 bg-white p-7 sm:p-10">
          <div className="pb-7">
            <p className="text-xs font-bold tracking-[0.18em] text-stone-500">
              SHORT NOTES
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              タイトルなしの短文も、そのまま残す。
            </p>
          </div>
          <div className="py-7">
            <p className="text-xs font-bold tracking-[0.18em] text-stone-500">
              LONG READS
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              日記や制作記録を、読みやすい記事に。
            </p>
          </div>
          <div className="pt-7">
            <p className="text-xs font-bold tracking-[0.18em] text-stone-500">
              ALL PROJECTS
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Projectをまたいで時系列に並びます。
            </p>
          </div>
        </div>
      </header>

      <nav
        aria-label="投稿ジャンル"
        className="mt-8 border-y border-stone-300 py-4"
      >
        <ul className="flex gap-2 overflow-x-auto pb-1">
          <li>
            <Link
              aria-current="page"
              className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-stone-950 px-5 text-sm font-bold text-white"
              href="/blog"
            >
              すべて
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-700 transition hover:border-stone-500 hover:text-stone-950"
                href={`/blog/categories/${category.slug}`}
              >
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-16 sm:mt-24">
        <div className="flex items-end justify-between gap-4 border-b border-stone-300 pb-4">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-stone-500">
              TIMELINE
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">
              すべての投稿
            </h2>
          </div>
          <p className="text-sm font-semibold text-stone-500">
            {posts.length} POSTS
          </p>
        </div>

        {posts.length ? (
          <div
            className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-testid="blog-card-list"
          >
            {posts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="mt-7">
            <EmptyState>公開された投稿はまだありません。</EmptyState>
          </div>
        )}
      </section>

      <AdSlot />
    </main>
  );
}
