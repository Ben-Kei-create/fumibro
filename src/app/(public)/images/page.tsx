import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getPublicImages } from "@/modules/images/application/get-public-images";
import { imageLicenseLabel } from "@/modules/images/domain/downloadable-image";

export const metadata: Metadata = {
  alternates: { canonical: "/images" },
  description:
    "FUMIBROが制作・配布する、用途とライセンスを明記した無料画像ギャラリー。",
  openGraph: {
    description: "FUMIBROの無料画像ギャラリー",
    title: "FUMIBRO Images",
    type: "website",
    url: "/images",
  },
  title: "Images",
};

export default async function ImagesPage() {
  const images = await getPublicImages();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          FREE IMAGE GALLERY
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          FUMIBRO Images
        </h1>
        <p className="mt-5 text-lg leading-8 text-stone-600">
          制作した画像を、用途とライセンスを明記して無料配布します。
        </p>
      </header>
      <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {images.length ? (
          images.map((item) => (
            <article
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              key={item.id}
            >
              <Link
                className="block aspect-[4/3] overflow-hidden bg-stone-100"
                href={`/images/${item.slug}`}
              >
                <Image
                  alt={item.thumbnail.altText}
                  className="h-full w-full object-cover transition-transform hover:scale-[1.02]"
                  height={item.thumbnail.height}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  src={item.thumbnail.url}
                  width={item.thumbnail.width}
                />
              </Link>
              <div className="p-5">
                <h2 className="text-lg font-bold">
                  <Link href={`/images/${item.slug}`}>{item.title}</Link>
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">
                  {item.description}
                </p>
                <p className="mt-4 text-xs text-stone-500">
                  {imageLicenseLabel(item.licenseType)}
                  {item.project ? ` · ${item.project.name}` : ""}
                </p>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-stone-600 sm:col-span-2 lg:col-span-3">
            公開中の画像はまだありません。
          </p>
        )}
      </div>
    </main>
  );
}
