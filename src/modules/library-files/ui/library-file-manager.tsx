"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { AdminLibraryFile } from "@/modules/content-admin/application/admin-public-content";
import { archiveLibraryFileAction } from "@/modules/library-files/application/library-file-actions";
import {
  allowedLibraryMimeTypes,
  MAX_LIBRARY_FILE_BYTES,
} from "@/modules/library-files/domain/download-policy";

const reservationSchema = z.object({
  assetId: z.string().uuid(),
  bucket: z.literal("private-downloads"),
  mimeType: z.string(),
  path: z.string(),
  token: z.string(),
});

export function LibraryFileManager({
  files,
  libraryItemId,
}: {
  files: AdminLibraryFile[];
  libraryItemId: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [displayName, setDisplayName] = useState("");
  const [versionLabel, setVersionLabel] = useState("1");
  const [isPrimary, setIsPrimary] = useState(files.length === 0);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function upload() {
    if (
      !file ||
      !allowedLibraryMimeTypes.includes(
        file.type as (typeof allowedLibraryMimeTypes)[number],
      ) ||
      file.size < 1 ||
      file.size > MAX_LIBRARY_FILE_BYTES
    ) {
      setError("PDFまたはZIPを100MB以下で選択してください。");
      return;
    }
    const metadata = {
      displayName: displayName.trim() || file.name,
      displayOrder: files.length,
      isPrimary,
      libraryItemId,
      versionLabel,
    };
    setPending(true);
    setError(undefined);
    try {
      setStatus("private downloadsへのアップロードを準備しています…");
      const init = await fetch("/api/admin/library-files/init", {
        body: JSON.stringify({
          ...metadata,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const reservation = reservationSchema.safeParse(await init.json());
      if (!init.ok || !reservation.success)
        throw new Error("reservation_failed");
      setStatus("private領域へアップロードしています…");
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
      if (uploaded.error) throw new Error("upload_failed");
      setStatus("署名とサイズを検証しています…");
      const complete = await fetch(
        `/api/admin/library-files/${reservation.data.assetId}/complete`,
        {
          body: JSON.stringify(metadata),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      if (!complete.ok) throw new Error("completion_failed");
      setFile(undefined);
      setDisplayName("");
      setStatus("ファイルを添付しました。");
      router.refresh();
    } catch {
      setStatus(undefined);
      setError(
        "ファイルを登録できませんでした。形式・サイズ・接続状態を確認してください。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="mt-10 rounded-xl border border-stone-200 bg-white p-5"
      aria-labelledby="library-files"
    >
      <h2 className="text-xl font-bold" id="library-files">
        配布ファイル
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        PDF・ZIPはprivate
        downloadsで保持し、公開条件をサーバーで毎回確認して60秒の署名URLを発行します。
      </p>
      <div className="mt-5 space-y-3">
        {files.map((item) => (
          <div
            className="flex flex-col justify-between gap-3 rounded-lg bg-stone-50 p-4 sm:flex-row sm:items-center"
            key={item.id}
          >
            <div>
              <p className="font-semibold">
                {item.displayName}
                {item.isPrimary ? " · PRIMARY" : ""}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                v{item.versionLabel} · {item.mimeType} ·{" "}
                {(item.sizeBytes / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <form action={archiveLibraryFileAction}>
              <input name="fileId" type="hidden" value={item.id} />
              <input name="libraryItemId" type="hidden" value={libraryItemId} />
              <button
                className="min-h-11 px-3 text-sm font-semibold text-red-700"
                type="submit"
              >
                Archive
              </button>
            </form>
          </div>
        ))}
        {!files.length ? (
          <p className="text-sm text-stone-500">添付ファイルはありません。</p>
        ) : null}
      </div>
      <fieldset className="mt-6 space-y-4 border-t border-stone-200 pt-6">
        <legend className="font-semibold">新しいファイル</legend>
        <input
          accept={allowedLibraryMimeTypes.join(",")}
          disabled={pending}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            setFile(selected);
            setDisplayName(selected?.name ?? "");
          }}
          type="file"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            表示名
            <input
              className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
              maxLength={255}
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </label>
          <label className="text-sm font-semibold">
            version
            <input
              className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
              maxLength={40}
              onChange={(event) => setVersionLabel(event.target.value)}
              value={versionLabel}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
            type="checkbox"
          />
          Primary fileにする
        </label>
        <button
          className="button-secondary"
          disabled={!file || pending}
          onClick={() => void upload()}
          type="button"
        >
          {pending ? "処理中…" : "アップロードして添付"}
        </button>
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
      </fieldset>
    </section>
  );
}
