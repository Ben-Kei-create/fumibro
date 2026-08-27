import { getPostFormOptions } from "@/modules/blog/application/get-post-form-options";
import { getLibraryPolicies } from "@/modules/content-admin/application/admin-public-content";
import { LibraryEditorForm } from "@/modules/content-admin/ui/library-editor-form";

export default async function NewLibraryItemPage() {
  const [options, policies] = await Promise.all([
    getPostFormOptions("/admin/library/new"),
    getLibraryPolicies(),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">NEW LIBRARY ITEM</p>
      <h1 className="mt-1 text-3xl font-bold">Libraryへ追加</h1>
      <LibraryEditorForm options={options} policies={policies} />
    </div>
  );
}
