import type { Metadata } from "next";

import {
  purgeContentAction,
  setContentTrashAction,
} from "@/modules/blog/application/post-actions";
import { getAdminTrash } from "@/modules/content-admin/application/get-admin-trash";

export const metadata: Metadata = { title: "Trash" };

type AdminTrashPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminTrashPage({
  searchParams,
}: AdminTrashPageProps) {
  const [result, query] = await Promise.all([getAdminTrash(), searchParams]);

  return (
    <div>
      <p className="text-sm font-semibold text-stone-500">ARCHIVE</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">Trash</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
        通常削除したBlog・Works・Library等を保持します。復元はすぐ行えます。完全削除はAAL2に加え、対象名の入力と明示確認が必要です。
      </p>

      {query.changed ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {query.changed === "purged"
            ? "投稿と専用Storageオブジェクトを完全削除しました。"
            : "投稿をTrashから復元しました。"}
        </p>
      ) : null}
      {query.error ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {query.error === "confirmation"
            ? "完全削除の確認内容が一致しません。"
            : "操作を完了できませんでした。Storage失敗は再試行可能なjobとして保持されます。"}
        </p>
      ) : null}

      <div className="mt-7 space-y-4">
        {result.hasError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            Trashを取得できませんでした。
          </p>
        ) : result.items.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
            Trashは空です。
          </p>
        ) : (
          result.items.map((post) => {
            const confirmation = post.title?.trim() || post.slug;

            return (
              <article
                className="rounded-xl border border-stone-200 bg-white p-5"
                key={post.contentId}
              >
                <h2 className="text-lg font-semibold text-stone-950">
                  {post.title || "（タイトルなし）"}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  <span className="mr-2 rounded bg-stone-100 px-2 py-0.5 font-semibold uppercase">
                    {post.kind}
                  </span>
                  <span className="font-mono">{post.slug}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
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
                      className="button-secondary"
                      name="mode"
                      type="submit"
                      value="restore"
                    >
                      復元
                    </button>
                  </form>
                  <details className="w-full rounded-lg border border-red-200 bg-red-50 p-4 sm:w-auto sm:min-w-96">
                    <summary className="cursor-pointer text-sm font-semibold text-red-800">
                      完全削除
                    </summary>
                    <form
                      action={purgeContentAction}
                      className="mt-4 space-y-3"
                    >
                      <input
                        name="contentId"
                        type="hidden"
                        value={post.contentId}
                      />
                      <label className="block text-sm leading-6 text-red-950">
                        確認のため <strong>{confirmation}</strong> と入力
                        <input
                          autoComplete="off"
                          className="mt-1 min-h-11 w-full rounded-lg border border-red-300 bg-white px-3"
                          name="confirmation"
                          required
                        />
                      </label>
                      <label className="flex items-start gap-2 text-sm text-red-950">
                        <input
                          className="mt-1"
                          name="confirmPermanent"
                          required
                          type="checkbox"
                        />
                        Revisionと専用画像を含め、元に戻せないことを確認しました
                      </label>
                      <button
                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
                        type="submit"
                      >
                        完全削除を実行
                      </button>
                    </form>
                  </details>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
