import type { Metadata } from "next";
import Link from "next/link";

import { setContentTrashAction } from "@/modules/blog/application/post-actions";
import { getAdminPosts } from "@/modules/blog/application/get-admin-post";

export const metadata: Metadata = { title: "Blog管理" };

type AdminPostsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function statusLabel(status: string, publishAt: string | null) {
  if (status === "published" && publishAt && new Date(publishAt) > new Date()) {
    return "予約";
  }

  return (
    { draft: "下書き", hidden: "非公開", published: "公開" }[status] ?? status
  );
}

export default async function AdminPostsPage({
  searchParams,
}: AdminPostsPageProps) {
  const [result, query] = await Promise.all([getAdminPosts(), searchParams]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-500">BLOG CMS</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">Blog投稿</h1>
        </div>
        <div className="flex gap-3">
          <Link className="button-secondary" href="/admin/trash">
            Trash
          </Link>
          <Link className="button-primary" href="/admin/posts/new">
            新規投稿
          </Link>
        </div>
      </div>

      {query.changed === "trashed" ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          投稿をTrashへ移動しました。Trashから復元できます。
        </p>
      ) : null}
      {query.error ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          操作を完了できませんでした。競合している場合は再読込してください。
        </p>
      ) : null}
      {result.hasError ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          投稿一覧を取得できませんでした。
        </p>
      ) : null}

      <div className="mt-7 space-y-3">
        {result.posts.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
            投稿はまだありません。
          </p>
        ) : (
          result.posts.map((post) => (
            <article
              className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center"
              key={post.contentId}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
                    {statusLabel(post.status, post.publishAt)}
                  </span>
                  {post.publishAt ? (
                    <time
                      className="text-xs text-stone-500"
                      dateTime={post.publishAt}
                    >
                      {dateFormatter.format(new Date(post.publishAt))}
                    </time>
                  ) : null}
                </div>
                <h2 className="mt-2 truncate text-lg font-semibold text-stone-950">
                  {post.title || "（タイトルなし）"}
                </h2>
                <p className="mt-1 truncate font-mono text-xs text-stone-500">
                  /blog/{post.slug}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="button-secondary"
                  href={`/admin/posts/${post.contentId}/edit`}
                >
                  編集
                </Link>
                <form action={setContentTrashAction}>
                  <input
                    name="contentId"
                    type="hidden"
                    value={post.contentId}
                  />
                  <input
                    name="expectedLockVersion"
                    type="hidden"
                    value={post.lockVersion}
                  />
                  <button
                    className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                    name="mode"
                    type="submit"
                    value="trash"
                  >
                    Trashへ
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
