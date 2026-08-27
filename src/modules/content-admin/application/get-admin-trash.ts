import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export async function getAdminTrash() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/trash" });
  const result = await supabase
    .from("content_items")
    .select("id,kind,slug,title,lock_version,deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(200);
  return {
    hasError: Boolean(result.error),
    items: (result.data ?? []).map((item) => ({
      contentId: item.id,
      deletedAt: item.deleted_at!,
      kind: item.kind,
      lockVersion: item.lock_version,
      slug: item.slug,
      title: item.title,
    })),
  };
}
