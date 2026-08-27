import { formatTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import {
  archiveNoticeAction,
  saveNoticeAction,
} from "@/modules/site-admin/application/site-admin-actions";
import { getAdminNotices } from "@/modules/site-admin/application/get-site-admin-data";

export default async function AdminNoticesPage() {
  const notices = await getAdminNotices();
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold text-stone-500">PINNED BOARD</p>
      <h1 className="mt-1 text-3xl font-bold">掲示板</h1>
      <p className="mt-3 text-stone-600">
        最大10件程度をHomeへ固定表示します。終了日時は任意です。
      </p>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {[...notices, null].map((notice, index) => (
          <form
            action={saveNoticeAction}
            className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
            key={notice?.id ?? `new-${index}`}
          >
            <input name="id" type="hidden" value={notice?.id ?? ""} />
            <h2 className="font-bold">
              {notice ? notice.title : "新しい掲示"}
            </h2>
            <label className="block text-sm font-semibold">
              タイトル
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                defaultValue={notice?.title}
                maxLength={200}
                name="title"
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              本文
              <textarea
                className="mt-2 min-h-28 w-full rounded-lg border border-stone-300 p-3 font-normal"
                defaultValue={notice?.body}
                maxLength={3000}
                name="body"
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                リンクURL
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={notice?.link_url ?? ""}
                  name="linkUrl"
                />
              </label>
              <label className="text-sm font-semibold">
                リンク表示
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={notice?.link_label ?? ""}
                  maxLength={100}
                  name="linkLabel"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                開始（日本時間）
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={
                    notice ? formatTokyoDateTimeLocal(notice.starts_at) : ""
                  }
                  name="startsAt"
                  required
                  type="datetime-local"
                />
              </label>
              <label className="text-sm font-semibold">
                終了（任意）
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={
                    notice?.ends_at
                      ? formatTokyoDateTimeLocal(notice.ends_at)
                      : ""
                  }
                  name="endsAt"
                  type="datetime-local"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                状態
                <select
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
                  defaultValue={notice?.status ?? "draft"}
                  name="status"
                >
                  <option value="draft">下書き</option>
                  <option value="published">公開</option>
                  <option value="hidden">非公開</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                表示順
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={notice?.display_order ?? 0}
                  name="displayOrder"
                  type="number"
                />
              </label>
            </div>
            <button className="button-primary" type="submit">
              保存
            </button>
            {notice ? (
              <button
                className="ml-3 text-sm font-semibold text-red-700"
                formAction={archiveNoticeAction}
                type="submit"
              >
                Archive
              </button>
            ) : null}
          </form>
        ))}
      </div>
    </div>
  );
}
