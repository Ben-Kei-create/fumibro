import { ArrowRight, Cat, Hash, Search } from "lucide-react";
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

function PostMeta({ post }: { post: PublicPostDto }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-stone-500">
      <time dateTime={post.publishAt}>{formatPublicDate(post.publishAt)}</time>
      {post.feedEventType ? (
        <span className="rounded-full bg-stone-950 px-2.5 py-1 text-[0.65rem] tracking-[0.08em] text-white">
          {post.feedEventType.toUpperCase()}
        </span>
      ) : null}
      {post.project ? (
        <Link
          className="transition hover:text-stone-950"
          href={`/projects/${post.project.slug}`}
        >
          {post.project.name}
        </Link>
      ) : null}
      {post.category ? (
        <Link
          className="transition hover:text-stone-950"
          href={`/blog/categories/${post.category.slug}`}
        >
          {post.category.label}
        </Link>
      ) : null}
    </div>
  );
}

function PostTags({ post }: { post: PublicPostDto }) {
  if (!post.tags.length) return null;

  return (
    <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2">
      {post.tags.map((tag) => (
        <Link
          className="inline-flex items-center gap-0.5 text-xs font-medium text-stone-500 transition hover:text-stone-950"
          href={`/tags/${tag.slug}`}
          key={tag.slug}
        >
          <Hash aria-hidden="true" className="size-3" />
          {tag.label}
        </Link>
      ))}
    </div>
  );
}

function FeaturedPost({ post }: { post: PublicPostDto }) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-stone-300 bg-white shadow-[0_22px_60px_-42px_rgba(28,25,23,0.65)]">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <Link
          aria-label={`${post.title ?? "無題の投稿"}を読む`}
          className="relative min-h-72 overflow-hidden bg-stone-950 lg:min-h-[34rem]"
          href={`/blog/${post.slug}`}
        >
          {post.image ? (
            <PublicImage image={post.image} />
          ) : (
            <div className="flex h-full min-h-72 flex-col justify-between p-7 text-white sm:p-10 lg:min-h-[34rem]">
              <div className="flex items-center justify-between text-xs font-bold tracking-[0.22em] text-stone-400">
                <span>LATEST STORY</span>
                <Cat aria-hidden="true" className="size-7" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-stone-400">
                  FUMIBRO JOURNAL
                </p>
                <p className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  書くことも、つくることも、同じタイムラインへ。
                </p>
              </div>
            </div>
          )}
        </Link>

        <div className="flex flex-col justify-between p-7 sm:p-10">
          <div>
            <PostMeta post={post} />
            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-stone-950 sm:text-4xl">
              <Link href={`/blog/${post.slug}`}>
                {post.title ?? "無題の投稿"}
              </Link>
            </h2>
            <p className="mt-5 line-clamp-7 whitespace-pre-wrap text-base leading-8 text-stone-600">
              {post.excerpt ?? post.body}
            </p>
            <PostTags post={post} />
          </div>
          <Link
            className="group mt-10 inline-flex items-center gap-2 text-sm font-bold text-stone-950"
            href={`/blog/${post.slug}`}
          >
            続きを読む
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

function TimelinePost({ index, post }: { index: number; post: PublicPostDto }) {
  return (
    <article className="group grid gap-5 border-b border-stone-300 py-8 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[4.5rem_1fr_auto] sm:gap-7">
      <p className="text-xs font-bold tracking-[0.18em] text-stone-400">
        {String(index + 2).padStart(2, "0")}
      </p>
      <div className="min-w-0">
        <PostMeta post={post} />
        <h2 className="mt-3 text-2xl font-bold leading-snug tracking-tight text-stone-950">
          <Link href={`/blog/${post.slug}`}>{post.title ?? "無題の投稿"}</Link>
        </h2>
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-stone-600 sm:text-base">
          {post.excerpt ?? post.body}
        </p>
        <PostTags post={post} />
      </div>
      {post.image ? (
        <Link
          aria-label={`${post.title ?? "無題の投稿"}を読む`}
          className="h-40 overflow-hidden rounded-2xl bg-stone-200 sm:h-32 sm:w-44"
          href={`/blog/${post.slug}`}
        >
          <PublicImage image={post.image} />
        </Link>
      ) : (
        <Link
          aria-label={`${post.title ?? "無題の投稿"}を読む`}
          className="hidden size-12 place-items-center self-center rounded-full border border-stone-300 text-stone-500 transition group-hover:border-stone-950 group-hover:bg-stone-950 group-hover:text-white sm:grid"
          href={`/blog/${post.slug}`}
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </article>
  );
}

export function BlogIndex({ categories, posts }: BlogIndexProps) {
  const [featuredPost, ...timelinePosts] = posts;

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
          <Link
            className="inline-flex w-fit items-center gap-2 text-sm font-bold text-stone-950"
            href="/search"
          >
            <Search aria-hidden="true" className="size-4" />
            Blogを検索
          </Link>
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

        {featuredPost ? (
          <div className="mt-7">
            <FeaturedPost post={featuredPost} />
            {timelinePosts.length ? (
              <div className="mt-12 rounded-[2rem] border border-stone-300 bg-[#efede8] p-6 sm:p-9">
                {timelinePosts.map((post, index) => (
                  <TimelinePost index={index} key={post.id} post={post} />
                ))}
              </div>
            ) : null}
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
