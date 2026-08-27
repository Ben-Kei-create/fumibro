import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export async function getAdminComments() {
  const { supabase } = await requireAdmin({ nextPath: "/admin/comments" });
  const result = await supabase
    .from("comments")
    .select("id,post_id,display_name,body,status,submitted_at,deleted_at")
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(100);
  return result.data ?? [];
}
