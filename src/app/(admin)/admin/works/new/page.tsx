import { getPostFormOptions } from "@/modules/blog/application/get-post-form-options";
import { WorkEditorForm } from "@/modules/content-admin/ui/work-editor-form";

export default async function NewWorkPage() {
  const options = await getPostFormOptions("/admin/works/new");
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">NEW WORK</p>
      <h1 className="mt-1 text-3xl font-bold">作品を追加</h1>
      <WorkEditorForm options={options} />
    </div>
  );
}
