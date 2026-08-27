"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";

import type { AdminPostEditorDto } from "@/modules/blog/application/admin-post-dto";
import {
  savePostAction,
  type PostEditorActionState,
} from "@/modules/blog/application/post-actions";
import type { PostFormOptions } from "@/modules/blog/application/get-post-form-options";
import { ImageUploader } from "@/modules/media/ui/image-uploader";

type PostEditorFormProps = {
  defaultSlug?: string;
  initialPost?: AdminPostEditorDto;
  options: PostFormOptions;
  postedAt: string;
  publishAt: string;
};

const initialActionState: PostEditorActionState = { status: "idle" };

function SubmitButton({
  disabled,
  pending,
}: {
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <button
      className="button-primary w-full sm:w-auto"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "保存中…" : "投稿を保存"}
    </button>
  );
}

export function PostEditorForm({
  defaultSlug,
  initialPost,
  options,
  postedAt,
  publishAt,
}: PostEditorFormProps) {
  const [state, formAction, isPending] = useActionState(
    savePostAction,
    initialActionState,
  );
  const selectedTags = new Set(initialPost?.tagIds ?? []);

  return (
    <form
      className="mt-7 space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        const submittedData = new FormData(event.currentTarget);
        startTransition(() => formAction(submittedData));
      }}
    >
      <input
        name="contentId"
        type="hidden"
        value={initialPost?.contentId ?? ""}
      />
      <input
        name="expectedLockVersion"
        type="hidden"
        value={initialPost?.lockVersion ?? ""}
      />

      {state.status === "error" ? (
        <p
          className="rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      {options.hasError ? (
        <p
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          Project・ジャンル・タグ等を取得できませんでした。接続を確認してください。
        </p>
      ) : null}

      <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="post-title"
          >
            タイトル（任意）
          </label>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
            defaultValue={initialPost?.title}
            id="post-title"
            maxLength={240}
            name="title"
          />
        </div>

        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="post-slug"
          >
            slug
          </label>
          <input
            autoCapitalize="none"
            className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3 font-mono text-sm"
            defaultValue={initialPost?.slug ?? defaultSlug}
            id="post-slug"
            maxLength={160}
            name="slug"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="today-note"
            required
          />
          <p className="mt-1 text-xs text-stone-500">
            半角英小文字・数字・ハイフン
          </p>
        </div>

        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="post-excerpt"
          >
            短い説明（任意）
          </label>
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 px-3 py-3"
            defaultValue={initialPost?.excerpt}
            id="post-excerpt"
            maxLength={1000}
            name="excerpt"
          />
        </div>

        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="post-body"
          >
            本文
          </label>
          <textarea
            className="mt-2 min-h-80 w-full rounded-lg border border-stone-300 px-3 py-3 font-mono text-sm leading-7"
            defaultValue={initialPost?.body}
            id="post-body"
            maxLength={200000}
            name="body"
            required
          />
          <p className="mt-1 text-xs text-stone-500">
            Markdownとして保存します。公開時は安全なrendererを使用します。
          </p>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-stone-950">公開設定</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="post-status"
            >
              状態
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3"
              defaultValue={initialPost?.status ?? "draft"}
              id="post-status"
              name="status"
            >
              <option value="draft">下書き</option>
              <option value="published">公開 / 予約</option>
              <option value="hidden">非公開</option>
            </select>
          </div>
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="posted-at"
            >
              投稿日時（日本時間）
            </label>
            <input
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
              defaultValue={postedAt}
              id="posted-at"
              name="postedAt"
              required
              type="datetime-local"
            />
          </div>
          <div className="sm:col-span-2">
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="publish-at"
            >
              公開・予約日時（日本時間、任意）
            </label>
            <input
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
              defaultValue={publishAt}
              id="publish-at"
              name="publishAt"
              type="datetime-local"
            />
            <p className="mt-1 text-xs text-stone-500">
              「公開 /
              予約」で未来日時なら、その日時まで公開画面へ出ません。空欄なら即時公開です。
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-stone-950">分類</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="project"
            >
              Project
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3"
              defaultValue={initialPost?.projectId ?? ""}
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
              投稿ジャンル
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3"
              defaultValue={initialPost?.categoryId ?? ""}
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
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="location"
            >
              場所
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3"
              defaultValue={initialPost?.locationId ?? ""}
              id="location"
              name="locationId"
            >
              <option value="">指定なし</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-stone-800">
            タグ（最大20件）
          </legend>
          <div className="mt-2 flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-lg border border-stone-200 p-3">
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
                  <input
                    defaultChecked={selectedTags.has(tag.id)}
                    name="tagIds"
                    type="checkbox"
                    value={tag.id}
                  />
                  {tag.label}
                </label>
              ))
            )}
          </div>
        </fieldset>
      </section>

      <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-stone-950">画像・追加情報</h2>
        <ImageUploader initialImage={initialPost?.image} />
        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="external-url"
          >
            外部URL（任意）
          </label>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
            defaultValue={initialPost?.externalUrl}
            id="external-url"
            maxLength={2000}
            name="externalUrl"
            placeholder="https://example.com"
            type="url"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
          <label className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
            <input
              defaultChecked={initialPost?.isSpoiler}
              name="isSpoiler"
              type="checkbox"
            />
            ネタバレあり
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
            <input
              defaultChecked={initialPost?.watermarkEnabled}
              name="watermarkEnabled"
              type="checkbox"
            />
            透かしON（設定を保存）
          </label>
        </div>
      </section>

      {initialPost ? (
        <div>
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="change-reason"
          >
            更新メモ（任意・revision用）
          </label>
          <input
            className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3"
            id="change-reason"
            maxLength={1000}
            name="changeReason"
            placeholder="本文を追記"
          />
        </div>
      ) : (
        <input name="changeReason" type="hidden" value="初回作成" />
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link className="button-secondary" href="/admin/posts">
          一覧へ戻る
        </Link>
        <SubmitButton disabled={options.hasError} pending={isPending} />
      </div>
    </form>
  );
}
