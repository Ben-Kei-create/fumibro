import { notFound } from "next/navigation";

import { getPostFormOptions } from "@/modules/blog/application/get-post-form-options";
import { getAdminWork } from "@/modules/content-admin/application/admin-public-content";
import { WorkEditorForm } from "@/modules/content-admin/ui/work-editor-form";

export default async function EditWorkPage(
  props: PageProps<"/admin/works/[contentId]/edit">,
) {
  const { contentId } = await props.params;
  const [work, options] = await Promise.all([
    getAdminWork(contentId),
    getPostFormOptions(`/admin/works/${contentId}/edit`),
  ]);
  if (!work) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">EDIT WORK</p>
      <h1 className="mt-1 text-3xl font-bold">作品を編集</h1>
      <WorkEditorForm options={options} work={work} />
    </div>
  );
}
