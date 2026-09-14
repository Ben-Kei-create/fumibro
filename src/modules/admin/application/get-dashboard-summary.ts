import "server-only";

import { cache } from "react";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export type AdminDashboardSummary = {
  hasError: boolean;
  newInquiryCount: number;
  pendingAiHandoffCount: number;
  pendingCommentCount: number;
};

async function queryAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { supabase } = await requireAdmin();
  const [inquiriesResult, commentsResult, aiHandoffsResult] = await Promise.all(
    [
      supabase
        .from("contact_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "new")
        .is("deleted_at", null),
      supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("deleted_at", null),
      supabase
        .from("ai_handoff_inbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ],
  );

  return {
    hasError: Boolean(
      inquiriesResult.error || commentsResult.error || aiHandoffsResult.error,
    ),
    newInquiryCount: inquiriesResult.count ?? 0,
    pendingAiHandoffCount: aiHandoffsResult.count ?? 0,
    pendingCommentCount: commentsResult.count ?? 0,
  };
}

export const getAdminDashboardSummary = cache(queryAdminDashboardSummary);
