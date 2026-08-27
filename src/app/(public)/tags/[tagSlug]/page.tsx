import Link from "next/link";

import { getPublicPosts } from "@/modules/public-content/application/get-public-content";
import {
  EmptyState,
  PageHeading,
  PostCard,
} from "@/modules/public-content/ui/public-content";

export default async function TagPage(props: PageProps<"/tags/[tagSlug]">) {
  const { tagSlug } = await props.params;
  const posts = await getPublicPosts({ tagSlug });
  const label = posts
    .flatMap((post) => post.tags)
    .find((tag) => tag.slug === tagSlug)?.label;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading eyebrow="TAG" title={`#${label ?? tagSlug}`} />
      <p className="mt-4 text-sm text-stone-600">
        現在は同じタグが付いたBlog投稿を表示しています。
      </p>
      <Link className="mt-5 inline-flex text-sm font-semibold" href="/blog">
        ← Blogへ戻る
      </Link>
      <div className="mt-8 space-y-6">
        {posts.length ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <EmptyState>このタグの公開コンテンツはまだありません。</EmptyState>
        )}
      </div>
    </main>
  );
}
