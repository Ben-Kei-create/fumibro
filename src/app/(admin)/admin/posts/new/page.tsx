import type { Metadata } from "next";

import { formatTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import { getPostFormOptions } from "@/modules/blog/application/get-post-form-options";
import { makeQuickPostSlug } from "@/modules/blog/domain/quick-post";
import { PostEditorForm } from "@/modules/blog/ui/post-editor-form";

export const metadata: Metadata = { title: "Blog新規投稿" };

export default async function NewAdminPostPage() {
  const options = await getPostFormOptions();
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">BLOG</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">新規投稿</h1>
      <PostEditorForm
        defaultSlug={makeQuickPostSlug(now)}
        options={options}
        postedAt={formatTokyoDateTimeLocal(now)}
        publishAt=""
      />
    </div>
  );
}
