import type { Metadata } from "next";

import { getPublicWorks } from "@/modules/public-content/application/get-public-content";
import {
  EmptyState,
  PageHeading,
  WorkCard,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "FUMIBROの完成作品一覧。",
  title: "Works",
};

export default async function WorksPage() {
  const works = await getPublicWorks();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description="Kindle、教材、App、Webサイトなど、完成した制作物をまとめています。"
        eyebrow="FINISHED WORK"
        title="Works"
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {works.length ? (
          works.map((work) => <WorkCard key={work.id} work={work} />)
        ) : (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState>公開された作品はまだありません。</EmptyState>
          </div>
        )}
      </div>
    </main>
  );
}
