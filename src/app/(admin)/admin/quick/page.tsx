import type { Metadata } from "next";

import { getPostFormOptions } from "@/modules/blog/application/get-post-form-options";
import { createQuickPostAction } from "@/modules/blog/application/quick-post";
import { ImageUploader } from "@/modules/media/ui/image-uploader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quick投稿",
};

type QuickPostPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuickPostPage({
  searchParams,
}: QuickPostPageProps) {
  const parameters = await searchParams;
  const options = await getPostFormOptions("/admin/quick");
  const saved = typeof parameters.saved === "string" ? parameters.saved : null;
  const error = typeof parameters.error === "string" ? parameters.error : null;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold text-stone-500">MOBILE FRIENDLY</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">Quick投稿</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        本文を中心に、Project・ジャンル・タグを選んですぐ保存できます。
      </p>

      {saved ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {saved === "published"
            ? "投稿を公開しました。"
            : "下書きを保存しました。"}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error === "invalid"
            ? "入力内容を確認してください。"
            : "保存できませんでした。重複や接続状態を確認してください。"}
        </p>
      ) : null}
      {options.hasError ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          選択肢を取得できませんでした。Supabase接続を確認してください。
        </p>
      ) : null}

      <form
        action={createQuickPostAction}
        className="mt-6 space-y-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="quick-title"
          >
            タイトル（任意）
          </label>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
            id="quick-title"
            maxLength={240}
            name="title"
          />
        </div>

        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="quick-body"
          >
            本文
          </label>
          <textarea
            className="mt-2 min-h-48 w-full rounded-lg border border-stone-300 px-3 py-3 leading-7"
            id="quick-body"
            maxLength={200000}
            name="body"
            required
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="project"
            >
              Project
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3"
              id="project"
              name="projectId"
            >
              <option value="">指定なし</option>
              {options.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="category"
            >
              ジャンル
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3"
              id="category"
              name="categoryId"
            >
              <option value="">指定なし</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-stone-800">タグ</legend>
          <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-lg border border-stone-200 p-3">
            {options.tags.length === 0 ? (
              <p className="text-sm text-stone-500">
                登録済みタグはありません。
              </p>
            ) : (
              options.tags.map((tag) => (
                <label
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-stone-300 px-3 text-sm"
                  key={tag.id}
                >
                  <input name="tagIds" type="checkbox" value={tag.id} />
                  {tag.label}
                </label>
              ))
            )}
          </div>
        </fieldset>

        <ImageUploader />

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className="button-secondary w-full"
            disabled={options.hasError}
            name="publishMode"
            type="submit"
            value="draft"
          >
            下書き保存
          </button>
          <button
            className="button-primary w-full"
            disabled={options.hasError}
            name="publishMode"
            type="submit"
            value="published"
          >
            公開
          </button>
        </div>
      </form>
    </div>
  );
}
