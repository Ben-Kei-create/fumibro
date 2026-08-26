import "server-only";

import { cache } from "react";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export type AdminDashboardSummary = {
  hasError: boolean;
  newInquiryCount: number;
  pendingCommentCount: number;
};

async function queryAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { supabase } = await requireAdmin();
  const [inquiriesResult, commentsResult] = await Promise.all([
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
  ]);

  return {
    hasError: Boolean(inquiriesResult.error || commentsResult.error),
    newInquiryCount: inquiriesResult.count ?? 0,
    pendingCommentCount: commentsResult.count ?? 0,
  };
}

export const getAdminDashboardSummary = cache(queryAdminDashboardSummary);
