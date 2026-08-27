import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPublicPostCategories,
  getPublicPosts,
} from "@/modules/public-content/application/get-public-content";
import {
  EmptyState,
  PageHeading,
  PostCard,
} from "@/modules/public-content/ui/public-content";

export default async function BlogCategoryPage(
  props: PageProps<"/blog/categories/[categorySlug]">,
) {
  const { categorySlug } = await props.params;
  const [categories, posts] = await Promise.all([
    getPublicPostCategories(),
    getPublicPosts({ categorySlug }),
  ]);
  const category = categories.find((item) => item.slug === categorySlug);
  if (!category) notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading eyebrow="BLOG CATEGORY" title={category.label} />
      <Link className="mt-5 inline-flex text-sm font-semibold" href="/blog">
        ← Blogへ戻る
      </Link>
      <div className="mt-8 space-y-6">
        {posts.length ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <EmptyState>このジャンルの投稿はまだありません。</EmptyState>
        )}
      </div>
    </main>
  );
}
