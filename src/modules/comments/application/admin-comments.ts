import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export async function getAdminComments(
  status?: "hidden" | "pending" | "spam" | "visible",
) {
  const { supabase } = await requireAdmin({ nextPath: "/admin/comments" });
  let query = supabase
    .from("comments")
    .select("id,post_id,display_name,body,status,submitted_at,deleted_at")
    .is("deleted_at", null);
  if (status) query = query.eq("status", status);
  const result = await query
    .order("submitted_at", { ascending: false })
    .limit(100);
  return result.data ?? [];
}
