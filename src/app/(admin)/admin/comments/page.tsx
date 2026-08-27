import Link from "next/link";
import { z } from "zod";

import { getAdminComments } from "@/modules/comments/application/admin-comments";
import { moderateCommentAction } from "@/modules/comments/application/comment-actions";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export default async function AdminCommentsPage({
  searchParams,
}: PageProps<"/admin/comments">) {
  const parameters = await searchParams;
  const parsedStatus = z
    .enum(["hidden", "pending", "spam", "visible"])
    .safeParse(parameters.status);
  const comments = await getAdminComments(
    parsedStatus.success ? parsedStatus.data : undefined,
  );
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">MODERATION</p>
      <h1 className="mt-1 text-3xl font-bold">コメント</h1>
      {parsedStatus.success ? (
        <p className="mt-3 text-sm text-stone-600">
          {parsedStatus.data}だけを表示中 ·{" "}
          <Link className="underline" href="/admin/comments">
            すべて表示
          </Link>
        </p>
      ) : null}
      <div className="mt-7 space-y-4">
        {comments.map((comment) => (
          <article
            className="rounded-xl border border-stone-200 bg-white p-5"
            key={comment.id}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">{comment.display_name}</p>
              <p className="text-xs text-stone-500">
                {comment.status} ·{" "}
                {formatter.format(new Date(comment.submitted_at))}
              </p>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm leading-7">
              {comment.body}
            </p>
            <form
              action={moderateCommentAction}
              className="mt-4 flex flex-wrap gap-2"
            >
              <input name="commentId" type="hidden" value={comment.id} />
              <input name="postId" type="hidden" value={comment.post_id} />
              <button
                className="button-secondary"
                name="mode"
                type="submit"
                value="visible"
              >
                承認・表示
              </button>
              <button
                className="button-secondary"
                name="mode"
                type="submit"
                value="hidden"
              >
                非表示
              </button>
              <button
                className="button-secondary"
                name="mode"
                type="submit"
                value="spam"
              >
                Spam
              </button>
              <button
                className="min-h-11 px-3 text-sm font-semibold text-red-700"
                name="mode"
                type="submit"
                value="delete"
              >
                削除
              </button>
            </form>
          </article>
        ))}
        {!comments.length ? (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-7 text-center text-stone-600">
            コメントはありません。
          </p>
        ) : null}
      </div>
    </div>
  );
}
