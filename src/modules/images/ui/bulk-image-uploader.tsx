"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { z } from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  allowedImageMimeTypes,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@/modules/media/domain/image-policy";

const reservationSchema = z.object({
  assetId: z.string().uuid(),
  bucket: z.literal("private-originals"),
  mimeType: z.string(),
  path: z.string(),
  token: z.string(),
});
const completedSchema = z.object({
  assetId: z.string().uuid(),
  downloadReady: z.literal(true),
});
const draftsSchema = z.object({ created: z.array(z.string().uuid()) });

type UploadState = { filename: string; status: string };

export function BulkImageUploader() {
  const inputId = useId();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<UploadState[]>([]);
  const [error, setError] = useState<string>();
  const [isUploading, setIsUploading] = useState(false);

  function selectFiles(selected: File[]) {
    const valid = selected.slice(0, 30);
    setFiles(valid);
    setItems(valid.map((file) => ({ filename: file.name, status: "待機中" })));
    setError(
      selected.length > 30
        ? "一度に登録できる画像は30枚までです。先頭30枚を選択しました。"
        : undefined,
    );
  }

  async function uploadAll() {
    if (!files.length) return;
    const invalid = files.find(
      (file) =>
        !allowedImageMimeTypes.includes(
          file.type as (typeof allowedImageMimeTypes)[number],
        ) ||
        file.size < 1 ||
        file.size > MAX_IMAGE_UPLOAD_BYTES,
    );
    if (invalid) {
      setError(`${invalid.name}: JPEG・PNG・WebP、20MB以下のみ登録できます。`);
      return;
    }

    setIsUploading(true);
    setError(undefined);
    const completed: Array<{ assetId: string; filename: string }> = [];
    try {
      for (const [index, file] of files.entries()) {
        setItems((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "privateへ転送中" } : item,
          ),
        );
        const initialized = await fetch("/api/admin/uploads/init", {
          body: JSON.stringify({
            altText: file.name.replace(/\.[^.]+$/u, ""),
            filename: file.name,
            mimeType: file.type,
            purpose: "downloadable-image",
            sizeBytes: file.size,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const reservation = reservationSchema.safeParse(
          await initialized.json(),
        );
        if (!initialized.ok || !reservation.success)
          throw new Error(`initialize:${file.name}`);
        const uploaded = await createBrowserSupabaseClient()
          .storage.from(reservation.data.bucket)
          .uploadToSignedUrl(
            reservation.data.path,
            reservation.data.token,
            file,
            {
              cacheControl: "3600",
              contentType: reservation.data.mimeType,
            },
          );
        if (uploaded.error) throw new Error(`upload:${file.name}`);

        setItems((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "検証・変換中" } : item,
          ),
        );
        const finalized = await fetch(
          `/api/admin/uploads/${reservation.data.assetId}/complete`,
          { method: "POST" },
        );
        const ready = completedSchema.safeParse(await finalized.json());
        if (!finalized.ok || !ready.success)
          throw new Error(`process:${file.name}`);
        completed.push({ assetId: ready.data.assetId, filename: file.name });
        setItems((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "変換済み" } : item,
          ),
        );
      }

      const drafts = await fetch("/api/admin/images", {
        body: JSON.stringify({ images: completed }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const created = draftsSchema.safeParse(await drafts.json());
      if (
        !drafts.ok ||
        !created.success ||
        created.data.created.length !== completed.length
      ) {
        throw new Error("drafts");
      }
      setItems((current) =>
        current.map((item) => ({ ...item, status: "下書き登録済み" })),
      );
      setFiles([]);
      router.refresh();
    } catch {
      setError(
        "処理を完了できませんでした。完了済み画像はMediaに保持されています。再実行前に一覧を確認してください。",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-bold">画像を一括アップロード</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        最大30枚。masterはprivate originals、標準配布版はprivate
        downloadsへ保存します。
      </p>
      <label
        className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-5 text-center hover:border-stone-500"
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          selectFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="font-semibold">ここへドラッグ＆ドロップ</span>
        <span className="mt-1 text-sm text-stone-500">
          またはクリックして複数選択
        </span>
        <input
          accept={allowedImageMimeTypes.join(",")}
          className="sr-only"
          disabled={isUploading}
          id={inputId}
          multiple
          onChange={(event) =>
            selectFiles(Array.from(event.target.files ?? []))
          }
          type="file"
        />
      </label>
      {items.length ? (
        <ul className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
          {items.map((item, index) => (
            <li
              className="flex justify-between gap-4 rounded-lg bg-stone-50 px-3 py-2"
              key={`${item.filename}-${index}`}
            >
              <span className="truncate">{item.filename}</span>
              <span className="shrink-0 text-stone-500">{item.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        className="button-primary mt-5"
        disabled={!files.length || isUploading}
        onClick={() => void uploadAll()}
        type="button"
      >
        {isUploading ? "アップロード中…" : `${files.length}枚を登録`}
      </button>
    </section>
  );
}
