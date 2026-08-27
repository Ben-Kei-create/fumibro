import { notFound } from "next/navigation";

import { getPostFormOptions } from "@/modules/blog/application/get-post-form-options";
import {
  getAdminLibraryItem,
  getLibraryPolicies,
} from "@/modules/content-admin/application/admin-public-content";
import { LibraryEditorForm } from "@/modules/content-admin/ui/library-editor-form";

export default async function EditLibraryItemPage(
  props: PageProps<"/admin/library/[contentId]/edit">,
) {
  const { contentId } = await props.params;
  const [item, options, policies] = await Promise.all([
    getAdminLibraryItem(contentId),
    getPostFormOptions(`/admin/library/${contentId}/edit`),
    getLibraryPolicies(),
  ]);
  if (!item) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">EDIT LIBRARY ITEM</p>
      <h1 className="mt-1 text-3xl font-bold">Libraryを編集</h1>
      <LibraryEditorForm item={item} options={options} policies={policies} />
    </div>
  );
}
