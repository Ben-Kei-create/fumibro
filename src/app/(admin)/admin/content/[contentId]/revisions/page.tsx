import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getContentRevisions } from "@/modules/blog/application/get-content-revisions";
import { restoreContentRevisionAction } from "@/modules/blog/application/post-actions";

export const metadata: Metadata = { title: "Revision履歴" };

type ContentRevisionsPageProps = {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Tokyo",
});

export default async function ContentRevisionsPage({
  params,
  searchParams,
}: ContentRevisionsPageProps) {
  const [{ contentId }, query] = await Promise.all([params, searchParams]);

  if (!z.string().uuid().safeParse(contentId).success) {
    notFound();
  }

  const result = await getContentRevisions(contentId);

  if (!result) {
    notFound();
  }

  const editHref =
    result.content.kind === "post"
      ? `/admin/posts/${contentId}/edit`
      : result.content.kind === "work"
        ? `/admin/works/${contentId}/edit`
        : result.content.kind === "library"
          ? `/admin/library/${contentId}/edit`
          : `/admin/pages/${contentId}/edit`;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-stone-500">CONTENT REVISION</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">
        {result.content.label}
      </h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        復元前には現在状態も自動snapshotされるため、復元操作自体をやり直せます。
      </p>

      {query.error ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          Revisionを復元できませんでした。対象がTrashにある場合は先に復元してください。
        </p>
      ) : null}

      <div className="mt-7 space-y-3">
        {result.revisions.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
            Revisionはまだありません。
          </p>
        ) : (
          result.revisions.map((revision) => (
            <article
              className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center"
              key={revision.id}
            >
              <div className="flex-1">
                <p className="font-semibold text-stone-950">
                  #{revision.revisionNo} · {revision.eventType.toUpperCase()}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {revision.changeReason || "更新メモなし"}
                </p>
                <time
                  className="mt-1 block text-xs text-stone-500"
                  dateTime={revision.createdAt}
                >
                  {dateFormatter.format(new Date(revision.createdAt))}
                </time>
              </div>
              <form action={restoreContentRevisionAction}>
                <input name="contentId" type="hidden" value={contentId} />
                <input name="kind" type="hidden" value={result.content.kind} />
                <button
                  className="button-secondary"
                  name="revisionId"
                  type="submit"
                  value={revision.id}
                >
                  この版へ復元
                </button>
              </form>
            </article>
          ))
        )}
      </div>

      <Link className="button-secondary mt-7" href={editHref}>
        編集画面へ戻る
      </Link>
    </div>
  );
}
