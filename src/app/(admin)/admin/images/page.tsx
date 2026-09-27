import type { Metadata } from "next";
import Image from "next/image";

import { formatTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import {
  bulkUpdateDownloadableImagesAction,
  saveDownloadableImageAction,
} from "@/modules/images/application/image-actions";
import { getAdminImages } from "@/modules/images/application/get-admin-images";
import {
  clearanceLabel,
  distributionClearances,
  downloadableImageStatuses,
  imageLicenseLabel,
  imageLicenseTypes,
} from "@/modules/images/domain/downloadable-image";
import { BulkImageUploader } from "@/modules/images/ui/bulk-image-uploader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "FUMIBRO Images" };

export default async function AdminImagesPage({
  searchParams,
}: PageProps<"/admin/images">) {
  const [data, query] = await Promise.all([getAdminImages(), searchParams]);
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold text-stone-500">IMAGE DISTRIBUTION</p>
      <h1 className="mt-1 text-3xl font-bold">FUMIBRO Images</h1>
      <p className="mt-3 max-w-3xl leading-7 text-stone-600">
        Portfolioとは分離した無料画像ギャラリーです。アップロード直後は必ず非公開・要確認です。
      </p>
      {query.saved ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          保存しました。
        </p>
      ) : null}
      {query.error || data.hasError ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          保存または取得に失敗しました。入力・権利確認・接続状態を確認してください。
        </p>
      ) : null}
      <div className="mt-7">
        <BulkImageUploader />
      </div>

      {data.images.length ? (
        <form
          action={bulkUpdateDownloadableImagesAction}
          className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7"
        >
          <h2 className="text-xl font-bold">一括編集</h2>
          <p className="mt-2 text-sm text-stone-600">
            対象を選び、共通設定を適用します。公開には各画像の固有説明と用途例が必要です。
          </p>
          <div className="mt-4 grid max-h-52 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
            {data.images.map((image) => (
              <label className="flex items-center gap-2 text-sm" key={image.id}>
                <input name="imageIds" type="checkbox" value={image.id} />
                {image.title}
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold">
              公開状態
              <select
                className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                defaultValue="draft"
                name="bulkStatus"
              >
                {downloadableImageStatuses.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              配布確認
              <select
                className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                defaultValue="review_required"
                name="bulkClearance"
              >
                {distributionClearances.map((value) => (
                  <option key={value} value={value}>
                    {clearanceLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              ライセンス
              <select
                className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                defaultValue="all_rights_reserved"
                name="bulkLicense"
              >
                {imageLicenseTypes.map((value) => (
                  <option key={value} value={value}>
                    {imageLicenseLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Project
              <select
                className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                name="bulkProjectId"
              >
                <option value="">指定なし</option>
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Wonderloom作品名
              <input
                className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                maxLength={240}
                name="bulkSourceWorkTitle"
              />
            </label>
            <label className="flex items-center gap-2 self-end text-sm font-semibold">
              <input name="bulkDownloadEnabled" type="checkbox" />
              無料DLを有効化
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="bulkAdsEnabled" type="checkbox" />
              広告を許可
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">タグ</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {data.tags.map((tag) => (
                <label className="text-sm" key={tag.id}>
                  <input
                    className="mr-1"
                    name="bulkTagIds"
                    type="checkbox"
                    value={tag.id}
                  />
                  {tag.label}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="button-secondary mt-5" type="submit">
            選択画像へ適用
          </button>
        </form>
      ) : null}

      <div className="mt-7 space-y-5">
        {data.images.length ? (
          data.images.map((image) => (
            <details
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
              key={image.id}
            >
              <summary className="flex cursor-pointer items-center gap-4 p-4 sm:p-5">
                {image.thumbnailUrl ? (
                  <Image
                    alt={image.title}
                    className="h-20 w-24 rounded-lg object-cover"
                    height={80}
                    sizes="96px"
                    src={image.thumbnailUrl}
                    width={96}
                  />
                ) : null}
                <span className="min-w-0">
                  <strong className="block truncate">{image.title}</strong>
                  <span className="mt-1 block text-xs text-stone-500">
                    {image.status} ·{" "}
                    {clearanceLabel(image.distributionClearance)} · DL{" "}
                    {image.downloadCount}
                  </span>
                </span>
              </summary>
              <form
                action={saveDownloadableImageAction}
                className="grid gap-4 border-t border-stone-200 p-5 lg:grid-cols-2"
              >
                <input name="imageId" type="hidden" value={image.id} />
                <input
                  name="expectedLockVersion"
                  type="hidden"
                  value={image.lockVersion}
                />
                <input name="assetId" type="hidden" value={image.assetId} />
                <input
                  name="downloadAssetId"
                  type="hidden"
                  value={image.downloadAssetId}
                />
                <label className="text-sm font-semibold">
                  タイトル
                  <input
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={image.title}
                    maxLength={240}
                    name="title"
                    required
                  />
                </label>
                <label className="text-sm font-semibold">
                  slug
                  <input
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-mono font-normal"
                    defaultValue={image.slug}
                    name="slug"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                  />
                </label>
                <label className="text-sm font-semibold lg:col-span-2">
                  説明（公開時40文字以上）
                  <textarea
                    className="mt-2 min-h-32 w-full rounded-lg border p-3 font-normal"
                    defaultValue={image.description}
                    name="description"
                    required
                  />
                </label>
                <label className="text-sm font-semibold lg:col-span-2">
                  用途例（公開時10文字以上）
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-lg border p-3 font-normal"
                    defaultValue={image.useExamples}
                    name="useExamples"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Project
                  <select
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={image.projectId}
                    name="projectId"
                  >
                    <option value="">指定なし</option>
                    {data.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Wonderloom作品名
                  <input
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={image.sourceWorkTitle}
                    maxLength={240}
                    name="sourceWorkTitle"
                  />
                </label>
                <label className="text-sm font-semibold">
                  出所
                  <select
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={image.sourceSystem}
                    name="sourceSystem"
                  >
                    {data.sources.map((source) => (
                      <option key={source.code} value={source.code}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  ライセンス
                  <select
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={image.licenseType}
                    name="licenseType"
                  >
                    {imageLicenseTypes.map((value) => (
                      <option key={value} value={value}>
                        {imageLicenseLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  配布確認
                  <select
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={image.distributionClearance}
                    name="distributionClearance"
                  >
                    {distributionClearances.map((value) => (
                      <option key={value} value={value}>
                        {clearanceLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  公開状態
                  <select
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={image.status}
                    name="status"
                  >
                    {downloadableImageStatuses.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  公開日時
                  <input
                    className="mt-2 min-h-11 w-full rounded-lg border px-3 font-normal"
                    defaultValue={
                      image.publishedAt
                        ? formatTokyoDateTimeLocal(image.publishedAt)
                        : ""
                    }
                    name="publishedAt"
                    type="datetime-local"
                  />
                </label>
                <fieldset className="lg:col-span-2">
                  <legend className="text-sm font-semibold">タグ</legend>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {data.tags.map((tag) => (
                      <label className="text-sm" key={tag.id}>
                        <input
                          className="mr-1"
                          defaultChecked={image.tagIds.includes(tag.id)}
                          name="tagIds"
                          type="checkbox"
                          value={tag.id}
                        />
                        {tag.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex flex-wrap gap-5 lg:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      defaultChecked={image.downloadEnabled}
                      name="downloadEnabled"
                      type="checkbox"
                    />
                    無料DL
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      defaultChecked={image.adsEnabled}
                      name="adsEnabled"
                      type="checkbox"
                    />
                    広告ON
                  </label>
                </div>
                <button className="button-primary lg:col-span-2" type="submit">
                  保存
                </button>
              </form>
            </details>
          ))
        ) : (
          <p className="rounded-xl border border-dashed bg-white p-8 text-center text-stone-600">
            画像はまだありません。
          </p>
        )}
      </div>
    </div>
  );
}
