import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPublicImage,
  getRelatedPublicImages,
} from "@/modules/images/application/get-public-images";
import { imageLicenseLabel } from "@/modules/images/domain/downloadable-image";
import {
  AdSlot,
  SafeRichText,
} from "@/modules/public-content/ui/public-content";

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export async function generateMetadata({
  params,
}: PageProps<"/images/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const image = await getPublicImage(slug);
  if (!image) return { title: "画像が見つかりません" };
  return {
    alternates: { canonical: `/images/${image.slug}` },
    description: image.description.slice(0, 160),
    openGraph: {
      description: image.description.slice(0, 200),
      images: [
        {
          alt: image.display.altText,
          height: image.display.height,
          url: image.display.url,
          width: image.display.width,
        },
      ],
      title: image.title,
      type: "article",
      url: `/images/${image.slug}`,
    },
    title: image.title,
  };
}

export default async function ImageDetailPage({
  params,
}: PageProps<"/images/[slug]">) {
  const { slug } = await params;
  const image = await getPublicImage(slug);
  if (!image) notFound();
  const related = await getRelatedPublicImages(image);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    contentUrl: image.display.url,
    description: image.description,
    license: imageLicenseLabel(image.licenseType),
    name: image.title,
    representativeOfPage: true,
    thumbnailUrl: image.thumbnail.url,
  };
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
        }}
        type="application/ld+json"
      />
      <article>
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            FUMIBRO IMAGES
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {image.title}
          </h1>
        </header>
        <Image
          alt={image.display.altText}
          className="mt-8 h-auto max-h-[75vh] w-full rounded-2xl bg-stone-100 object-contain"
          height={image.display.height}
          priority
          sizes="(max-width: 1024px) 100vw, 1024px"
          src={image.display.url}
          width={image.display.width}
        />
        <section className="mt-9">
          <h2 className="text-2xl font-bold">この画像について</h2>
          <div className="mt-4">
            <SafeRichText value={image.description} />
          </div>
        </section>
        <dl className="mt-7 grid gap-4 rounded-2xl bg-stone-100 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-semibold">サイズ</dt>
            <dd className="mt-1 text-stone-600">
              {image.downloadWidth} × {image.downloadHeight}px
            </dd>
          </div>
          <div>
            <dt className="font-semibold">形式</dt>
            <dd className="mt-1 text-stone-600">
              {image.format} · {formatBytes(image.sizeBytes)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">ライセンス</dt>
            <dd className="mt-1 text-stone-600">
              {imageLicenseLabel(image.licenseType)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">ダウンロード</dt>
            <dd className="mt-1 text-stone-600">
              {image.downloadCount.toLocaleString("ja-JP")}回
            </dd>
          </div>
        </dl>
        <div className="mt-7 flex flex-wrap gap-3">
          {image.downloadEnabled ? (
            <a
              className="button-primary"
              href={`/api/images/${image.id}/download`}
            >
              標準解像度を無料ダウンロード
            </a>
          ) : (
            <span className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-600">
              現在ダウンロードできません
            </span>
          )}
          {image.project ? (
            <Link
              className="button-secondary"
              href={`/projects/${image.project.slug}`}
            >
              {image.project.name}
            </Link>
          ) : null}
        </div>
        <section className="mt-12 border-t border-stone-200 pt-9">
          <h2 className="text-2xl font-bold">用途例</h2>
          <div className="mt-4">
            <SafeRichText value={image.useExamples} />
          </div>
          {image.sourceWorkTitle ? (
            <p className="mt-5 text-sm text-stone-600">
              関連作品：{image.sourceWorkTitle}
            </p>
          ) : null}
          {image.tags.length ? (
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {image.tags.map((tag) => (
                <Link href={`/tags/${tag.slug}`} key={tag.slug}>
                  #{tag.label}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </article>
      <div className="mt-14">
        <AdSlot enabled={image.adsEnabled} />
      </div>
      {related.length ? (
        <section className="mt-14">
          <h2 className="text-2xl font-bold">関連画像</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link
                className="overflow-hidden rounded-xl border bg-white"
                href={`/images/${item.slug}`}
                key={item.id}
              >
                <Image
                  alt={item.thumbnail.altText}
                  className="aspect-[4/3] w-full object-cover"
                  height={item.thumbnail.height}
                  sizes="(max-width: 640px) 100vw, 33vw"
                  src={item.thumbnail.url}
                  width={item.thumbnail.width}
                />
                <span className="block p-3 font-semibold">{item.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
