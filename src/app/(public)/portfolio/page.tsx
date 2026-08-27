import type { Metadata } from "next";

import { getPortfolioWorks } from "@/modules/public-content/application/get-public-content";
import {
  EmptyState,
  PageHeading,
  WorkCard,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "仕事依頼のためのFUMIBRO Portfolio。",
  title: "Portfolio",
};

export default async function PortfolioPage() {
  const works = await getPortfolioWorks();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description="制作実績と作品を、案件相談のためにまとめています。"
        eyebrow="SELECTED WORK"
        title="Portfolio"
      />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {works.length ? (
          works.map((work) => <WorkCard key={work.id} portfolio work={work} />)
        ) : (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState>Portfolioへ掲載する作品はまだありません。</EmptyState>
          </div>
        )}
      </div>
    </main>
  );
}
