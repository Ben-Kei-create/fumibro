"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export async function archiveLibraryFileAction(formData: FormData) {
  const parsed = z
    .object({
      fileId: z.string().uuid(),
      libraryItemId: z.string().uuid(),
    })
    .safeParse({
      fileId: formData.get("fileId"),
      libraryItemId: formData.get("libraryItemId"),
    });
  if (!parsed.success) redirect("/admin/library?error=validation");
  const path = `/admin/library/${parsed.data.libraryItemId}/edit`;
  const { supabase } = await requireAdmin({ nextPath: path });
  const result = await supabase.rpc("admin_archive_library_file", {
    p_library_file_id: parsed.data.fileId,
  });
  if (result.error) redirect(`${path}?error=archive`);
  revalidatePath(path);
  revalidatePath("/library");
  redirect(`${path}?archived=1`);
}
