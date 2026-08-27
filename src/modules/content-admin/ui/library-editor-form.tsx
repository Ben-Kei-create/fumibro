"use client";

import { useActionState } from "react";

import { formatTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import type { PostFormOptions } from "@/modules/blog/application/get-post-form-options";
import type { AdminLibraryEditor } from "@/modules/content-admin/application/admin-public-content";
import {
  ContentEditorActionState,
  saveLibraryAction,
} from "@/modules/content-admin/application/public-content-actions";
import { ImageUploader } from "@/modules/media/ui/image-uploader";

const initialState: ContentEditorActionState = { status: "idle" };

export function LibraryEditorForm({
  item,
  options,
  policies,
}: {
  item?: AdminLibraryEditor;
  options: PostFormOptions;
  policies: Array<{ code: string; label: string }>;
}) {
  const [state, action, isPending] = useActionState(
    saveLibraryAction,
    initialState,
  );
  return (
    <form action={action} className="mt-7 space-y-6">
      <input name="contentId" type="hidden" value={item?.id ?? ""} />
      <input
        name="expectedLockVersion"
        type="hidden"
        value={item?.lockVersion ?? ""}
      />
      {state.message ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          タイトル
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
            defaultValue={item?.title}
            maxLength={240}
            name="title"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          slug
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-mono font-normal"
            defaultValue={item?.slug}
            maxLength={160}
            name="slug"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        一覧用excerpt
        <textarea
          className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 p-3 font-normal"
          defaultValue={item?.excerpt}
          maxLength={1000}
          name="excerpt"
        />
      </label>
      <label className="block text-sm font-semibold">
        説明
        <textarea
          className="mt-2 min-h-64 w-full rounded-lg border border-stone-300 p-3 font-normal"
          defaultValue={item?.description}
          maxLength={200000}
          name="description"
        />
      </label>
      <ImageUploader initialImage={item?.cover} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Project
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
            defaultValue={item?.projectId}
            name="projectId"
          >
            <option value="">なし</option>
            {options.projects.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Access policy
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
            defaultValue={item?.accessPolicy ?? "public"}
            name="accessPolicy"
          >
            {policies.map((policy) => (
              <option key={policy.code} value={policy.code}>
                {policy.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="rounded-xl border border-stone-200 p-4">
        <legend className="px-1 text-sm font-semibold">タグ</legend>
        <div className="flex flex-wrap gap-3">
          {options.tags.map((tag) => (
            <label className="flex items-center gap-2 text-sm" key={tag.id}>
              <input
                defaultChecked={item?.tagIds.includes(tag.id)}
                name="tagIds"
                type="checkbox"
                value={tag.id}
              />
              {tag.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-6 rounded-xl bg-stone-50 p-4 text-sm font-semibold">
        <label className="flex items-center gap-2">
          <input
            defaultChecked={item?.downloadEnabled}
            name="downloadEnabled"
            type="checkbox"
          />
          ダウンロード可
        </label>
        <label className="flex items-center gap-2">
          <input
            defaultChecked={item?.inlinePreviewEnabled}
            name="inlinePreviewEnabled"
            type="checkbox"
          />
          ブラウザ内preview（将来）
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          状態
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
            defaultValue={item?.status ?? "draft"}
            name="status"
          >
            <option value="draft">下書き</option>
            <option value="published">公開</option>
            <option value="hidden">非公開</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          公開日時（日本時間）
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
            defaultValue={
              item?.publishAt ? formatTokyoDateTimeLocal(item.publishAt) : ""
            }
            name="publishAt"
            type="datetime-local"
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        変更理由
        <input
          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
          maxLength={1000}
          name="changeReason"
        />
      </label>
      <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        有料・限定・email gateの実ファイルはprivate downloadsへ置き、Phase
        1では匿名配信しません。
      </p>
      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "保存中…" : "Libraryを保存"}
      </button>
    </form>
  );
}
