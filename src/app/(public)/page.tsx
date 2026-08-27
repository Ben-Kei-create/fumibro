import Link from "next/link";

import {
  getHomeWorks,
  getPublicNotices,
  getPublicPosts,
} from "@/modules/public-content/application/get-public-content";
import {
  AdSlot,
  EmptyState,
  PostCard,
  WorkCard,
} from "@/modules/public-content/ui/public-content";

export default async function HomePage() {
  const [posts, notices, works] = await Promise.all([
    getPublicPosts({ feedOrder: true, limit: 4 }),
    getPublicNotices(),
    getHomeWorks(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="rounded-3xl border border-stone-200 bg-white px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-sm font-semibold tracking-[0.22em] text-stone-500">
          PERSONAL MEDIA &amp; PROJECT HUB
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-stone-950 sm:text-6xl">
          FUMIBRO
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
          日々の記録、制作物、教材、出版、アプリを一つの場所から届けます。
        </p>
      </section>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-stone-500">LATEST</p>
            <h2 className="mt-1 text-3xl font-bold text-stone-950">最新投稿</h2>
          </div>
          <Link className="text-sm font-semibold" href="/blog">
            すべて見る →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {posts.length ? (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <div className="md:col-span-2">
              <EmptyState>公開されたBlog投稿はまだありません。</EmptyState>
            </div>
          )}
        </div>
      </section>

      <AdSlot />

      <section className="mt-14">
        <p className="text-sm font-semibold text-stone-500">PINNED BOARD</p>
        <h2 className="mt-1 text-3xl font-bold text-stone-950">掲示板</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {notices.length ? (
            notices.map((notice) => (
              <article
                className="rounded-2xl border border-stone-200 bg-white p-5"
                key={notice.id}
              >
                <h3 className="font-bold text-stone-950">{notice.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-600">
                  {notice.body}
                </p>
                {notice.linkUrl ? (
                  <Link
                    className="mt-4 inline-flex text-sm font-semibold underline decoration-stone-300 underline-offset-4"
                    href={notice.linkUrl}
                  >
                    {notice.linkLabel ?? "詳しく見る"}
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <div className="sm:col-span-2">
              <EmptyState>現在のお知らせはありません。</EmptyState>
            </div>
          )}
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-stone-500">RECENT WORKS</p>
            <h2 className="mt-1 text-3xl font-bold text-stone-950">
              最近の作品
            </h2>
          </div>
          <Link className="text-sm font-semibold" href="/works">
            すべて見る →
          </Link>
        </div>
        <div className="mt-6 flex snap-x gap-5 overflow-x-auto pb-3">
          {works.length ? (
            works.map((work) => (
              <div
                className="w-[82vw] max-w-sm shrink-0 snap-start"
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

      <section className="mt-14 rounded-2xl border border-stone-200 bg-stone-900 p-6 text-white sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-stone-300">
          QUESTION BOX
        </p>
        <h2 className="mt-2 text-2xl font-bold">FUMIBROに質問</h2>
        <p className="mt-3 max-w-2xl leading-7 text-stone-300">
          サイト内の情報へ答える質問箱を準備中です。現在は外部AIへ接続していません。
        </p>
        <button
          className="mt-5 min-h-11 rounded-lg bg-stone-700 px-5 text-sm font-semibold text-stone-300"
          disabled
          type="button"
        >
          準備中
        </button>
      </section>
    </main>
  );
}
