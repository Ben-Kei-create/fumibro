"use client";

import { useActionState } from "react";

import { formatTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import type { PostFormOptions } from "@/modules/blog/application/get-post-form-options";
import type { AdminWorkEditor } from "@/modules/content-admin/application/admin-public-content";
import {
  ContentEditorActionState,
  saveWorkAction,
} from "@/modules/content-admin/application/public-content-actions";
import { ImageUploader } from "@/modules/media/ui/image-uploader";

const initialState: ContentEditorActionState = { status: "idle" };

export function WorkEditorForm({
  options,
  work,
}: {
  options: PostFormOptions;
  work?: AdminWorkEditor;
}) {
  const [state, action, isPending] = useActionState(
    saveWorkAction,
    initialState,
  );
  return (
    <form action={action} className="mt-7 space-y-6">
      <input name="contentId" type="hidden" value={work?.id ?? ""} />
      <input
        name="expectedLockVersion"
        type="hidden"
        value={work?.lockVersion ?? ""}
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
            defaultValue={work?.title}
            maxLength={240}
            name="title"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          slug
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-mono font-normal"
            defaultValue={work?.slug}
            maxLength={160}
            name="slug"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        短い説明
        <textarea
          className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 p-3 font-normal"
          defaultValue={work?.summary}
          maxLength={1000}
          name="summary"
        />
      </label>
      <label className="block text-sm font-semibold">
        本文
        <textarea
          className="mt-2 min-h-64 w-full rounded-lg border border-stone-300 p-3 font-normal"
          defaultValue={work?.description}
          maxLength={200000}
          name="description"
        />
      </label>
      <label className="block text-sm font-semibold">
        一覧用excerpt
        <textarea
          className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 p-3 font-normal"
          defaultValue={work?.excerpt}
          maxLength={1000}
          name="excerpt"
        />
      </label>
      <ImageUploader initialImage={work?.image} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold">
          Project
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
            defaultValue={work?.projectId}
            name="projectId"
          >
            <option value="">なし</option>
            {options.projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          種別
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-mono font-normal"
            defaultValue={work?.workType ?? "other"}
            name="workType"
            pattern="[a-z0-9]+(?:_[a-z0-9]+)*"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          制作日
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
            defaultValue={work?.releasedOn}
            name="releasedOn"
            type="date"
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        外部URL
        <input
          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
          defaultValue={work?.externalUrl}
          maxLength={2000}
          name="externalUrl"
          type="url"
        />
      </label>
      <fieldset className="rounded-xl border border-stone-200 p-4">
        <legend className="px-1 text-sm font-semibold">タグ</legend>
        <div className="flex flex-wrap gap-3">
          {options.tags.map((tag) => (
            <label className="flex items-center gap-2 text-sm" key={tag.id}>
              <input
                defaultChecked={work?.tagIds.includes(tag.id)}
                name="tagIds"
                type="checkbox"
                value={tag.id}
              />
              {tag.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            defaultChecked={work?.showOnHome}
            name="showOnHome"
            type="checkbox"
          />
          Homeへ表示
        </label>
        <label className="text-sm font-semibold">
          Home表示順
          <input
            className="ml-3 w-24 rounded border border-stone-300 px-2 py-1 font-normal"
            defaultValue={work?.homeDisplayOrder ?? 0}
            name="homeDisplayOrder"
            type="number"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            defaultChecked={work?.showInPortfolio}
            name="showInPortfolio"
            type="checkbox"
          />
          Portfolioへ表示
        </label>
        <label className="text-sm font-semibold">
          Portfolio表示順
          <input
            className="ml-3 w-24 rounded border border-stone-300 px-2 py-1 font-normal"
            defaultValue={work?.portfolioDisplayOrder ?? 0}
            name="portfolioDisplayOrder"
            type="number"
          />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          状態
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
            defaultValue={work?.status ?? "draft"}
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
              work?.publishAt ? formatTokyoDateTimeLocal(work.publishAt) : ""
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
      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "保存中…" : "作品を保存"}
      </button>
    </form>
  );
}
