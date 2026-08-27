import Image from "next/image";

import { getAdminMedia } from "@/modules/media/application/get-admin-media";
import { updateImageAltTextAction } from "@/modules/media/application/media-actions";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type AdminMediaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminMediaPage({
  searchParams,
}: AdminMediaPageProps) {
  const [result, query] = await Promise.all([getAdminMedia(), searchParams]);

  return (
    <div>
      <p className="text-sm font-semibold text-stone-500">STORAGE</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">Media</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
        元画像はprivate originals、表示画像とthumbnailだけをpublic
        mediaへ保存します。
      </p>

      {result.hasError ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          Media一覧を取得できませんでした。
        </p>
      ) : null}
      {query.saved === "alt" ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          代替テキストを保存しました。
        </p>
      ) : null}
      {query.error ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          代替テキストを保存できませんでした。
        </p>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600 sm:col-span-2 lg:col-span-3">
            画像はまだありません。Blog投稿画面から追加できます。
          </p>
        ) : (
          result.items.map((item) => (
            <article
              className="overflow-hidden rounded-xl border border-stone-200 bg-white"
              key={item.id}
            >
              {item.thumbnailUrl ? (
                <Image
                  alt={item.altText || item.originalFilename}
                  className="aspect-video w-full object-cover"
                  height={360}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  src={item.thumbnailUrl}
                  width={640}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-stone-100 text-sm text-stone-500">
                  {item.state}
                </div>
              )}
              <div className="p-4">
                <h2 className="truncate font-semibold text-stone-950">
                  {item.originalFilename}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {item.mimeType} · {formatBytes(item.sizeBytes)}
                  {item.width && item.height
                    ? ` · ${item.width}×${item.height}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-stone-500">
                  {dateFormatter.format(new Date(item.createdAt))}
                </p>
                {item.errorMessage ? (
                  <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">
                    {item.errorMessage}
                  </p>
                ) : null}
                {item.state === "ready" ? (
                  <form action={updateImageAltTextAction} className="mt-4">
                    <input name="assetId" type="hidden" value={item.id} />
                    <label className="text-xs font-medium text-stone-700">
                      代替テキスト
                      <input
                        className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 px-2 text-sm"
                        defaultValue={item.altText ?? ""}
                        maxLength={500}
                        name="altText"
                      />
                    </label>
                    <button
                      className="button-secondary mt-2 w-full"
                      type="submit"
                    >
                      保存
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
