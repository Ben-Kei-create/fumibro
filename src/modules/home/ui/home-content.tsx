import {
  ArrowRight,
  BookOpen,
  Cat,
  Download,
  Images,
  Pin,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import type {
  PublicNoticeDto,
  PublicPostDto,
  PublicWorkDto,
} from "@/modules/public-content/application/public-content-dto";
import {
  AdSlot,
  EmptyState,
  formatPublicDate,
  PublicImage,
  WorkCard,
} from "@/modules/public-content/ui/public-content";

type HomeContentProps = {
  notices: PublicNoticeDto[];
  posts: PublicPostDto[];
  works: PublicWorkDto[];
};

const exploreLinks = [
  {
    description: "完成した本・教材・アプリ",
    href: "/works",
    icon: Images,
    label: "Works",
  },
  {
    description: "PDFや配布コンテンツ",
    href: "/library",
    icon: BookOpen,
    label: "Library",
  },
  {
    description: "ダウンロードできる画像",
    href: "/images",
    icon: Download,
    label: "Images",
  },
] as const;

function SectionHeading({
  eyebrow,
  href,
  linkLabel = "すべて見る",
  title,
}: {
  eyebrow: string;
  href?: string;
  linkLabel?: string;
  title: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-stone-300 pb-4">
      <div>
        <p className="text-xs font-bold tracking-[0.2em] text-stone-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">
          {title}
        </h2>
      </div>
      {href ? (
        <Link
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-stone-700 transition hover:text-stone-950"
          href={href}
        >
          {linkLabel}
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </div>
  );
}

function FeaturedPost({ post }: { post: PublicPostDto }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-stone-300 bg-white shadow-[0_18px_50px_-36px_rgba(28,25,23,0.55)]">
      <Link
        className="grid min-h-full md:grid-cols-[1.12fr_0.88fr]"
        href={`/blog/${post.slug}`}
      >
        <div className="relative min-h-64 overflow-hidden bg-stone-900 md:min-h-[30rem]">
          {post.image ? (
            <PublicImage image={post.image} priority />
          ) : (
            <div className="flex h-full min-h-64 flex-col justify-between p-7 text-white md:min-h-[30rem] md:p-9">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-[0.22em] text-stone-300">
                  FUMIBRO JOURNAL
                </span>
                <Cat aria-hidden="true" className="size-7 text-stone-300" />
              </div>
              <p className="max-w-sm text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                日々の記録と、制作の途中。
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between p-6 sm:p-8 md:p-9">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500">
              <time dateTime={post.publishAt}>
                {formatPublicDate(post.publishAt)}
              </time>
              {post.feedEventType ? (
                <span className="rounded-full bg-stone-950 px-2.5 py-1 text-[0.65rem] tracking-wide text-white">
                  {post.feedEventType.toUpperCase()}
                </span>
              ) : null}
              {post.project ? <span>{post.project.name}</span> : null}
            </div>
            <h3 className="mt-5 text-2xl font-bold leading-snug tracking-tight text-stone-950 sm:text-3xl">
              {post.title ?? "無題の投稿"}
            </h3>
            <p className="mt-4 line-clamp-6 whitespace-pre-wrap text-[0.98rem] leading-8 text-stone-600">
              {post.excerpt ?? post.body}
            </p>
          </div>
          <span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-stone-950">
            記事を読む
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition group-hover:translate-x-1"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}

function CompactPost({ post }: { post: PublicPostDto }) {
  return (
    <article className="group border-b border-stone-300 py-5 first:pt-0 last:border-0 last:pb-0">
      <Link
        className="grid grid-cols-[1fr_auto] items-start gap-5"
        href={`/blog/${post.slug}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500">
            <time dateTime={post.publishAt}>
              {formatPublicDate(post.publishAt)}
            </time>
            {post.feedEventType ? (
              <span className="text-[0.65rem] font-bold tracking-wide text-stone-800">
                {post.feedEventType.toUpperCase()}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-lg font-bold leading-snug text-stone-950 sm:text-xl">
            {post.title ?? "無題の投稿"}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">
            {post.excerpt ?? post.body}
          </p>
        </div>
        {post.image ? (
          <div className="h-20 w-24 overflow-hidden rounded-xl bg-stone-200 sm:h-24 sm:w-32">
            <PublicImage image={post.image} />
          </div>
        ) : (
          <ArrowRight
            aria-hidden="true"
            className="mt-8 size-5 text-stone-400 transition group-hover:translate-x-1 group-hover:text-stone-950"
          />
        )}
      </Link>
    </article>
  );
}

export function HomeContent({ notices, posts, works }: HomeContentProps) {
  const [featuredPost, ...remainingPosts] = posts;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-6 sm:px-8 sm:pb-28 sm:pt-10">
      <section className="grid overflow-hidden rounded-[2rem] border border-stone-300 bg-white lg:grid-cols-[1.45fr_0.55fr]">
        <div className="flex min-h-[32rem] flex-col justify-between bg-stone-950 p-7 text-white sm:p-10 lg:min-h-[38rem] lg:p-14">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold tracking-[0.24em] text-stone-400 sm:text-sm">
              PERSONAL MEDIA &amp; PROJECT HUB
            </p>
            <Cat aria-hidden="true" className="size-8 text-stone-300" />
          </div>

          <div className="py-16">
            <p className="text-sm font-semibold tracking-[0.18em] text-stone-400">
              つくる、読む、残す。
            </p>
            <h1 className="mt-5 text-5xl font-black tracking-[-0.055em] sm:text-7xl lg:text-8xl">
              FUMIBRO
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-stone-300 sm:text-lg">
              日々の記録、制作物、教材、出版、アプリ。
              <br className="hidden sm:block" />
              ばらばらの活動を、一つの場所から届けます。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-stone-950 transition hover:bg-stone-200"
              href="/blog"
            >
              最新記事を読む
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-stone-700 px-6 text-sm font-bold text-white transition hover:border-stone-500 hover:bg-stone-900"
              href="/projects"
            >
              Projectsを見る
            </Link>
          </div>
        </div>

        <div className="flex flex-col bg-[#e8e4dc] p-6 sm:p-8 lg:p-9">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-stone-600">
            <Sparkles aria-hidden="true" className="size-4" />
            EXPLORE
          </div>
          <div className="mt-8 flex flex-1 flex-col justify-center divide-y divide-stone-400/60">
            {exploreLinks.map(({ description, href, icon: Icon, label }) => (
              <Link
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-6 first:pt-0 last:pb-0"
                href={href}
                key={href}
              >
                <span className="grid size-11 place-items-center rounded-full bg-white/80 text-stone-800">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block text-lg font-bold text-stone-950">
                    {label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-stone-600">
                    {description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-5 text-stone-500 transition group-hover:translate-x-1 group-hover:text-stone-950"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-20 sm:mt-28">
        <SectionHeading eyebrow="LATEST" href="/blog" title="最新投稿" />
        {featuredPost ? (
          <div className="mt-7 grid gap-7 lg:grid-cols-[1.45fr_0.75fr]">
            <FeaturedPost post={featuredPost} />
            <div className="rounded-3xl border border-stone-300 bg-[#efede8] p-6 sm:p-7">
              <p className="mb-5 text-xs font-bold tracking-[0.18em] text-stone-500">
                MORE STORIES
              </p>
              {remainingPosts.length ? (
                remainingPosts.map((post) => (
                  <CompactPost key={post.id} post={post} />
                ))
              ) : (
                <p className="border-t border-stone-300 pt-5 text-sm leading-7 text-stone-600">
                  次の投稿を準備中です。
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-7">
            <EmptyState>公開されたBlog投稿はまだありません。</EmptyState>
          </div>
        )}
      </section>

      <AdSlot />

      <section className="mt-20 sm:mt-28">
        <SectionHeading eyebrow="PINNED BOARD" title="掲示板" />
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {notices.length ? (
            notices.map((notice, index) => (
              <article
                className="relative overflow-hidden rounded-2xl border border-stone-300 bg-[#f1dfb9] p-6 sm:p-7"
                key={notice.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-950 text-white">
                    <Pin aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-xs font-bold tracking-[0.16em] text-stone-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-bold text-stone-950">
                  {notice.title}
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
                  {notice.body}
                </p>
                {notice.linkUrl ? (
                  <Link
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-stone-950 underline decoration-stone-500 underline-offset-4"
                    href={notice.linkUrl}
                  >
                    {notice.linkLabel ?? "詳しく見る"}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <div className="md:col-span-2">
              <EmptyState>現在のお知らせはありません。</EmptyState>
            </div>
          )}
        </div>
      </section>

      <section className="mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="RECENT WORKS"
          href="/works"
          title="最近の作品"
        />
        <div className="mt-7 flex snap-x gap-5 overflow-x-auto pb-4">
          {works.length ? (
            works.map((work) => (
              <div
                className="w-[84vw] max-w-sm shrink-0 snap-start sm:w-[24rem]"
                key={work.id}
              >
                <WorkCard work={work} />
              </div>
            ))
          ) : (
            <div className="w-full">
              <EmptyState>Homeへ掲載する作品はまだありません。</EmptyState>
            </div>
          )}
        </div>
      </section>

      <section className="mt-20 grid overflow-hidden rounded-[2rem] border border-stone-700 bg-stone-950 text-white sm:mt-28 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex min-h-56 flex-col justify-between border-b border-stone-700 p-7 sm:p-10 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-[0.2em] text-stone-400">
              QUESTION BOX
            </p>
            <Cat aria-hidden="true" className="size-7 text-stone-400" />
          </div>
          <p className="mt-12 text-3xl font-bold tracking-tight sm:text-4xl">
            聞きたいことを、
            <br />
            ここから。
          </p>
        </div>
        <div className="p-7 sm:p-10">
          <h2 className="text-2xl font-bold sm:text-3xl">FUMIBROに質問</h2>
          <p className="mt-4 max-w-2xl leading-8 text-stone-300">
            サイト内の情報へ答える質問箱を準備中です。現在は外部AIへ接続していません。
          </p>
          <div className="mt-8 flex min-h-14 items-center justify-between gap-4 rounded-xl border border-stone-700 bg-stone-900 px-5">
            <span className="text-sm text-stone-500">質問を入力…</span>
            <button
              className="shrink-0 rounded-full bg-stone-700 px-4 py-2 text-xs font-bold text-stone-300"
              disabled
              type="button"
            >
              準備中
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
