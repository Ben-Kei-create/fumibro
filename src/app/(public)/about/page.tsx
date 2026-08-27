import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BusinessCardDialog } from "@/modules/business-card/ui/business-card-dialog";
import {
  getPrimaryBusinessCard,
  getPublicPage,
} from "@/modules/public-content/application/get-public-content";
import {
  PageHeading,
  SafeRichText,
  formatPublicDate,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "FUMIBROと運営者について。",
  title: "About",
};

export default async function AboutPage() {
  const [page, card] = await Promise.all([
    getPublicPage("about"),
    getPrimaryBusinessCard(),
  ]);
  if (!page) notFound();
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description={page.description ?? undefined}
        eyebrow="PROFILE"
        title={page.title}
      />
      <article className="mt-9 rounded-2xl border border-stone-200 bg-white p-6 sm:p-9">
        <SafeRichText value={page.body} />
      </article>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        {card ? <BusinessCardDialog card={card} /> : null}
        <p className="text-xs text-stone-500">
          更新: {formatPublicDate(page.updatedAt)}
        </p>
      </div>
    </main>
  );
}
