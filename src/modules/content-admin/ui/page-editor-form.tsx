"use client";

import { useActionState } from "react";

import { formatTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import type { AdminPageEditor } from "@/modules/content-admin/application/admin-public-content";
import {
  ContentEditorActionState,
  savePageAction,
} from "@/modules/content-admin/application/public-content-actions";

const initialState: ContentEditorActionState = { status: "idle" };

export function PageEditorForm({ page }: { page: AdminPageEditor }) {
  const [state, action, isPending] = useActionState(
    savePageAction,
    initialState,
  );
  return (
    <form action={action} className="mt-7 space-y-6">
      <input name="contentId" type="hidden" value={page.id} />
      <input
        name="expectedLockVersion"
        type="hidden"
        value={page.lockVersion}
      />
      {state.message ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
        Page key: <code>{page.pageKey}</code>
        {page.isSystem ? "（system page。非公開・削除不可）" : null}
      </p>
      <label className="block text-sm font-semibold">
        タイトル
        <input
          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
          defaultValue={page.title}
          maxLength={240}
          name="title"
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        概要
        <textarea
          className="mt-2 min-h-20 w-full rounded-lg border border-stone-300 p-3 font-normal"
          defaultValue={page.excerpt}
          maxLength={1000}
          name="excerpt"
        />
      </label>
      <label className="block text-sm font-semibold">
        本文
        <textarea
          className="mt-2 min-h-[32rem] w-full rounded-lg border border-stone-300 p-3 font-mono text-sm font-normal leading-7"
          defaultValue={page.body}
          maxLength={300000}
          name="body"
        />
      </label>
      <label className="block text-sm font-semibold">
        SEO description
        <input
          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
          defaultValue={page.seoDescription}
          maxLength={320}
          name="seoDescription"
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          状態
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
            defaultValue={page.status}
            disabled={page.isSystem}
            name={page.isSystem ? undefined : "status"}
          >
            <option value="draft">下書き</option>
            <option value="published">公開</option>
            <option value="hidden">非公開</option>
          </select>
          {page.isSystem ? (
            <input name="status" type="hidden" value="published" />
          ) : null}
        </label>
        <label className="text-sm font-semibold">
          公開日時（日本時間）
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
            defaultValue={
              page.publishAt ? formatTokyoDateTimeLocal(page.publishAt) : ""
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
        {isPending ? "保存中…" : "Pageを保存"}
      </button>
    </form>
  );
}
