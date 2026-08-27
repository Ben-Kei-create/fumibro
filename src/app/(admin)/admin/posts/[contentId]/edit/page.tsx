import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { formatTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import { getAdminPost } from "@/modules/blog/application/get-admin-post";
import { getPostFormOptions } from "@/modules/blog/application/get-post-form-options";
import { PostEditorForm } from "@/modules/blog/ui/post-editor-form";

export const metadata: Metadata = { title: "Blog編集" };

type EditAdminPostPageProps = {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditAdminPostPage({
  params,
  searchParams,
}: EditAdminPostPageProps) {
  const { contentId } = await params;

  if (!z.string().uuid().safeParse(contentId).success) {
    notFound();
  }

  const [post, options, query] = await Promise.all([
    getAdminPost(contentId),
    getPostFormOptions(),
    searchParams,
  ]);

  if (!post) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-500">BLOG</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">投稿を編集</h1>
        </div>
        <Link
          className="text-sm text-stone-600 underline"
          href={`/admin/content/${post.contentId}/revisions`}
        >
          Revision履歴
        </Link>
      </div>

      {query.saved === "1" ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          投稿を保存しました。
        </p>
      ) : null}
      {query.restored === "1" ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          選択したRevisionへ復元しました。復元直前の状態も履歴に残っています。
        </p>
      ) : null}

      <PostEditorForm
        initialPost={post}
        options={options}
        postedAt={formatTokyoDateTimeLocal(post.postedAt)}
        publishAt={
          post.publishAt ? formatTokyoDateTimeLocal(post.publishAt) : ""
        }
      />
    </div>
  );
}
