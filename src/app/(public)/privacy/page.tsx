import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicPage } from "@/modules/public-content/application/get-public-content";
import {
  PageHeading,
  SafeRichText,
  formatPublicDate,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "FUMIBROのプライバシーポリシー。",
  title: "Privacy",
};

export default async function PrivacyPage() {
  const page = await getPublicPage("privacy");
  if (!page) notFound();
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading eyebrow="POLICY" title={page.title} />
      <p className="mt-5 text-sm text-stone-500">
        最終更新: {formatPublicDate(page.updatedAt)}
      </p>
      <article className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 sm:p-9">
        <SafeRichText value={page.body} />
      </article>
    </main>
  );
}
