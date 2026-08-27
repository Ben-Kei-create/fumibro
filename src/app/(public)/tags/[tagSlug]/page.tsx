import Link from "next/link";
import { notFound } from "next/navigation";

import { getTaggedContent } from "@/modules/public-content/application/get-public-content";
import {
  ContentSummaryCard,
  EmptyState,
  PageHeading,
} from "@/modules/public-content/ui/public-content";

export default async function TagPage(props: PageProps<"/tags/[tagSlug]">) {
  const { tagSlug } = await props.params;
  const result = await getTaggedContent(tagSlug);
  if (!result) notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading eyebrow="CROSS-PROJECT TAG" title={`#${result.tag.label}`} />
      <p className="mt-4 text-sm text-stone-600">
        Blog・Works・LibraryをProject横断で表示します。
      </p>
      <Link className="mt-5 inline-flex text-sm font-semibold" href="/blog">
        ← Blogへ戻る
      </Link>
      <div className="mt-8 space-y-4">
        {result.items.length ? (
          result.items.map((item) => (
            <ContentSummaryCard item={item} key={item.id} />
          ))
        ) : (
          <EmptyState>このタグの公開コンテンツはまだありません。</EmptyState>
        )}
      </div>
    </main>
  );
}
