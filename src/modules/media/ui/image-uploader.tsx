"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { z } from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  allowedImageMimeTypes,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@/modules/media/domain/image-policy";
import type { SelectedImage } from "@/modules/media/domain/selected-image";

const reservationSchema = z.object({
  assetId: z.string().uuid(),
  bucket: z.literal("private-originals"),
  mimeType: z.string(),
  path: z.string(),
  token: z.string(),
});

const readyImageSchema = z.object({
  altText: z.string().nullable(),
  assetId: z.string().uuid(),
  displayUrl: z.string().url(),
  thumbnailUrl: z.string().url(),
});

type ImageUploaderProps = {
  initialImage?: SelectedImage;
};

export function ImageUploader({ initialImage }: ImageUploaderProps) {
  const inputId = useId();
  const altTextId = useId();
  const [file, setFile] = useState<File>();
  const [image, setImage] = useState<SelectedImage | undefined>(initialImage);
  const [altText, setAltText] = useState(initialImage?.altText ?? "");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    if (!file) {
      setError("アップロードする画像を1枚選択してください。");
      return;
    }

    if (
      !allowedImageMimeTypes.includes(
        file.type as (typeof allowedImageMimeTypes)[number],
      ) ||
      file.size < 1 ||
      file.size > MAX_IMAGE_UPLOAD_BYTES
    ) {
      setError("JPEG・PNG・WebPの静止画を20MB以下で選択してください。");
      return;
    }

    setError(undefined);
    setStatus("private originalsへのアップロードを準備しています…");
    setIsUploading(true);

    try {
      const initializeResponse = await fetch("/api/admin/uploads/init", {
        body: JSON.stringify({
          altText,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const reservation = reservationSchema.safeParse(
        await initializeResponse.json(),
      );

      if (!initializeResponse.ok || !reservation.success) {
        throw new Error("reservation_failed");
      }

      setStatus("元画像を安全なprivate領域へアップロードしています…");
      const supabase = createBrowserSupabaseClient();
      const uploadResult = await supabase.storage
        .from(reservation.data.bucket)
        .uploadToSignedUrl(
          reservation.data.path,
          reservation.data.token,
          file,
          {
            cacheControl: "3600",
            contentType: reservation.data.mimeType,
          },
        );

      if (uploadResult.error) {
        throw new Error("upload_failed");
      }

      setStatus("画像を検証し、表示用画像とthumbnailを生成しています…");
      const completeResponse = await fetch(
        `/api/admin/uploads/${reservation.data.assetId}/complete`,
        { method: "POST" },
      );
      const completed = readyImageSchema.safeParse(
        await completeResponse.json(),
      );

      if (!completeResponse.ok || !completed.success) {
        throw new Error("processing_failed");
      }

      setImage(completed.data);
      setFile(undefined);
      setStatus("画像を処理しました。投稿を保存すると添付されます。");
    } catch {
      setStatus(undefined);
      setError(
        "画像をアップロードできませんでした。形式・サイズ・接続状態を確認して再試行してください。",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function removeImage() {
    setImage(undefined);
    setFile(undefined);
    setAltText("");
    setStatus("投稿から画像を外します。元画像はMediaに保持されます。");
    setError(undefined);
  }

  return (
    <fieldset className="space-y-4 rounded-xl border border-stone-200 p-4">
      <legend className="px-1 text-sm font-semibold text-stone-900">
        画像（最大1枚）
      </legend>
      <input name="imageAssetId" type="hidden" value={image?.assetId ?? ""} />

      {image ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Image
            alt={image.altText || "投稿画像preview"}
            className="h-36 w-full rounded-lg object-cover sm:w-52"
            height={144}
            sizes="(max-width: 640px) 100vw, 208px"
            src={image.thumbnailUrl}
            width={208}
          />
          <div>
            <p className="text-sm leading-6 text-stone-600">
              圧縮済み表示画像とthumbnailを生成済みです。元画像はprivateで保持されます。
            </p>
            <button
              className="button-secondary mt-3"
              disabled={isUploading}
              onClick={removeImage}
              type="button"
            >
              投稿から外す
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor={altTextId}
            >
              代替テキスト（任意）
            </label>
            <input
              className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 px-3"
              id={altTextId}
              maxLength={500}
              onChange={(event) => setAltText(event.target.value)}
              value={altText}
            />
          </div>
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor={inputId}
            >
              JPEG / PNG / WebP（20MB以下）
            </label>
            <input
              accept={allowedImageMimeTypes.join(",")}
              className="mt-2 block w-full text-sm text-stone-700 file:mr-4 file:rounded-lg file:border-0 file:bg-stone-100 file:px-4 file:py-3 file:font-medium"
              disabled={isUploading}
              id={inputId}
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setError(undefined);
                setStatus(undefined);
              }}
              type="file"
            />
          </div>
          <button
            className="button-secondary"
            disabled={!file || isUploading}
            onClick={() => void upload()}
            type="button"
          >
            {isUploading ? "処理中…" : "画像をアップロード"}
          </button>
        </div>
      )}

      {status ? (
        <p className="text-sm text-emerald-800" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs leading-5 text-stone-500">
        透かしON/OFFは投稿に保存します。Phase
        1の画像processorは透かしなしvariantを生成し、将来のprocessor交換点を維持します。
      </p>
    </fieldset>
  );
}
