import type { Metadata } from "next";

import { getPublicLibrary } from "@/modules/public-content/application/get-public-content";
import {
  EmptyState,
  LibraryCard,
  PageHeading,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "FUMIBROの教材・PDF・配布ファイル。",
  title: "Library",
};

export default async function LibraryPage() {
  const items = await getPublicLibrary();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description="教材、PDF、資料などの配布・販売基盤です。公開情報とファイルのaccess policyを安全に分離しています。"
        eyebrow="FILES & MATERIALS"
        title="Library"
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.length ? (
          items.map((item) => <LibraryCard item={item} key={item.id} />)
        ) : (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState>公開されたLibrary項目はまだありません。</EmptyState>
          </div>
        )}
      </div>
    </main>
  );
}
