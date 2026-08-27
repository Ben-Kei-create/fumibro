import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPublicLibraryFiles,
  getPublicLibraryItem,
} from "@/modules/public-content/application/get-public-content";
import {
  AdSlot,
  SafeRichText,
  formatPublicDate,
} from "@/modules/public-content/ui/public-content";

const accessLabels: Record<string, string> = {
  email_gate: "メール登録後に利用",
  free_download: "無料ダウンロード",
  paid: "有料",
  public: "公開情報",
  restricted: "限定公開",
};

export async function generateMetadata(
  props: PageProps<"/library/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const item = await getPublicLibraryItem(slug);
  if (!item) return { title: "Library項目が見つかりません" };
  return { description: item.excerpt, title: item.title };
}

export default async function LibraryDetailPage(
  props: PageProps<"/library/[slug]">,
) {
  const { slug } = await props.params;
  const item = await getPublicLibraryItem(slug);
  if (!item) notFound();
  const files =
    item.downloadEnabled && item.accessPolicy === "free_download"
      ? await getPublicLibraryFiles(item.id)
      : [];
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <article>
        <header className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
            <span>{accessLabels[item.accessPolicy] ?? item.accessPolicy}</span>
            <time dateTime={item.publishedAt}>
              {formatPublicDate(item.publishedAt)}
            </time>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">
            {item.title}
          </h1>
          {item.excerpt ? (
            <p className="mt-5 text-lg leading-8 text-stone-600">
              {item.excerpt}
            </p>
          ) : null}
        </header>
        {item.cover ? (
          <Image
            alt={item.cover.altText}
            className="mt-8 h-auto w-full rounded-2xl"
            height={item.cover.height}
            priority
            sizes="(max-width: 896px) 100vw, 896px"
            src={item.cover.url}
            width={item.cover.width}
          />
        ) : null}
        <div className="mt-9">
          <SafeRichText value={item.description} />
        </div>
        {item.downloadEnabled &&
        item.accessPolicy === "free_download" &&
        files.length ? (
          <section
            className="mt-8 rounded-xl border border-stone-200 bg-white p-5"
            aria-labelledby="downloads"
          >
            <h2 className="font-bold" id="downloads">
              ダウンロード
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {files.map((file) => (
                <Link
                  className={
                    file.isPrimary ? "button-primary" : "button-secondary"
                  }
                  href={`/api/library/${file.id}/download`}
                  key={file.id}
                  prefetch={false}
                >
                  {file.displayName}（v{file.versionLabel}）
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <p className="mt-8 rounded-xl bg-stone-100 p-5 text-sm leading-7 text-stone-600">
            この項目は現在、匿名ダウンロードを提供していません。
          </p>
        )}
        {item.project ? (
          <Link
            className="button-secondary mt-7"
            href={`/projects/${item.project.slug}`}
          >
            {item.project.name}
          </Link>
        ) : null}
      </article>
      <div className="mt-12">
        <AdSlot />
      </div>
    </main>
  );
}
