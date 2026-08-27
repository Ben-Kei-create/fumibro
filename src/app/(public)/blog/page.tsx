import type { Metadata } from "next";
import Link from "next/link";

import {
  getPublicPostCategories,
  getPublicPosts,
} from "@/modules/public-content/application/get-public-content";
import {
  AdSlot,
  EmptyState,
  PageHeading,
  PostCard,
} from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "短文から長文まで、FUMIBROのすべての投稿。",
  title: "Blog",
};

export default async function BlogPage() {
  const [posts, categories] = await Promise.all([
    getPublicPosts(),
    getPublicPostCategories(),
  ]);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description="日常、食事、制作、映画、出版、教材、App。短文も長文も一つのタイムラインに並びます。"
        eyebrow="FUMIBRO'S CENTER"
        title="Blog"
      />
      <nav aria-label="投稿ジャンル" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
                href={`/blog/categories/${category.slug}`}
              >
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-8 space-y-6">
        {posts.length ? (
          posts.map((post, index) => (
            <div key={post.id}>
              <PostCard post={post} />
              {index === 2 ? (
                <div className="mt-6">
                  <AdSlot />
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState>公開された投稿はまだありません。</EmptyState>
        )}
      </div>
    </main>
  );
}
