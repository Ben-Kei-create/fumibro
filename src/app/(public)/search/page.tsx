import type { Metadata } from "next";

import { searchPublicContent } from "@/modules/public-content/application/get-public-content";
import {
  ContentSummaryCard,
  EmptyState,
  PageHeading,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "FUMIBRO全体を日本語全文検索。",
  title: "検索",
};

export default async function SearchPage(props: PageProps<"/search">) {
  const params = await props.searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const results = query ? await searchPublicContent(query) : [];
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description="タイトル・本文・タグ・Project名から検索します。"
        eyebrow="PGROONGA"
        title="検索"
      />
      <form
        action="/search"
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        method="get"
      >
        <label className="sr-only" htmlFor="site-search">
          キーワード
        </label>
        <input
          className="min-h-12 flex-1 rounded-lg border border-stone-300 bg-white px-4"
          defaultValue={query}
          id="site-search"
          maxLength={100}
          name="q"
          placeholder="検索キーワード"
          required
        />
        <button className="button-primary" type="submit">
          検索
        </button>
      </form>
      {query ? (
        <p className="mt-7 text-sm text-stone-600">
          「{query}」の検索結果: {results.length}件
        </p>
      ) : null}
      <div className="mt-5 space-y-4">
        {results.map((item) => (
          <ContentSummaryCard item={item} key={item.id} />
        ))}
        {query && !results.length ? (
          <EmptyState>一致する公開コンテンツはありません。</EmptyState>
        ) : null}
      </div>
    </main>
  );
}
