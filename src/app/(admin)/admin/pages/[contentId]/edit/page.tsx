import { notFound } from "next/navigation";

import { getAdminPage } from "@/modules/content-admin/application/admin-public-content";
import { PageEditorForm } from "@/modules/content-admin/ui/page-editor-form";

export default async function EditPagePage(
  props: PageProps<"/admin/pages/[contentId]/edit">,
) {
  const { contentId } = await props.params;
  const page = await getAdminPage(contentId);
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">EDIT PAGE</p>
      <h1 className="mt-1 text-3xl font-bold">{page.title}</h1>
      <PageEditorForm page={page} />
    </div>
  );
}
