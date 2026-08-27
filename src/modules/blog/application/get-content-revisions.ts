import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export type ContentRevisionDto = {
  changeReason: string | null;
  createdAt: string;
  eventType: "publish" | "update" | "restore" | "import";
  id: string;
  revisionNo: number;
};

export async function getContentRevisions(contentId: string) {
  const { supabase } = await requireAdmin({
    nextPath: `/admin/content/${contentId}/revisions`,
  });
  const [contentResult, revisionResult] = await Promise.all([
    supabase
      .from("content_items")
      .select("id,kind,title,slug,deleted_at")
      .eq("id", contentId)
      .maybeSingle(),
    supabase
      .from("content_revisions")
      .select("id,revision_no,event_type,change_reason,created_at")
      .eq("content_item_id", contentId)
      .order("revision_no", { ascending: false })
      .limit(100),
  ]);

  if (contentResult.error || !contentResult.data || revisionResult.error) {
    return null;
  }

  return {
    content: {
      deletedAt: contentResult.data.deleted_at,
      id: contentResult.data.id,
      kind: contentResult.data.kind,
      label: contentResult.data.title || contentResult.data.slug,
    },
    revisions: (revisionResult.data ?? []).map((revision) => ({
      changeReason: revision.change_reason,
      createdAt: revision.created_at,
      eventType: revision.event_type,
      id: revision.id,
      revisionNo: revision.revision_no,
    })) satisfies ContentRevisionDto[],
  };
}
