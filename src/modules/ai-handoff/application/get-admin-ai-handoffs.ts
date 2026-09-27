import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";
import type {
  AiHandoffDestination,
  AiHandoffStatus,
} from "@/modules/ai-handoff/domain/ai-handoff";

export type AdminAiHandoffDto = {
  contentItemId: string | null;
  createdAt: string;
  id: string;
  lastError: string | null;
  noticeId: string | null;
  payload: Readonly<Record<string, unknown>>;
  projectId: string | null;
  projectName: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  sourceDate: string | null;
  sourceExternalId: string;
  sourceSystem: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: AiHandoffStatus;
  suggestedBody: string | null;
  suggestedDestination: AiHandoffDestination;
  suggestedPublicUrl: string | null;
  suggestedTitle: string | null;
};

export type AdminAiHandoffProjectDto = {
  id: string;
  name: string;
};

export async function getAdminAiHandoffs(status?: AiHandoffStatus): Promise<{
  handoffs: AdminAiHandoffDto[];
  hasError: boolean;
  projects: AdminAiHandoffProjectDto[];
}> {
  const { supabase } = await requireAdmin({ nextPath: "/admin/ai-inbox" });
  let handoffQuery = supabase
    .from("ai_handoff_inbox")
    .select(
      "id,source_system,source_external_id,source_title,source_url,source_date,payload,suggested_project,suggested_destination,suggested_title,suggested_body,suggested_public_url,status,content_item_id,notice_id,reviewed_at,published_at,last_error,created_at",
    );

  if (status) handoffQuery = handoffQuery.eq("status", status);

  const [handoffsResult, projectsResult] = await Promise.all([
    handoffQuery.order("created_at", { ascending: false }).limit(100),
    supabase
      .from("projects")
      .select("id,name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order"),
  ]);
  const projectNames = new Map(
    (projectsResult.data ?? []).map((project) => [project.id, project.name]),
  );

  return {
    handoffs: (handoffsResult.data ?? []).map((handoff) => ({
      contentItemId: handoff.content_item_id,
      createdAt: handoff.created_at,
      id: handoff.id,
      lastError: handoff.last_error,
      noticeId: handoff.notice_id,
      payload:
        handoff.payload && typeof handoff.payload === "object"
          ? (handoff.payload as Readonly<Record<string, unknown>>)
          : {},
      projectId: handoff.suggested_project,
      projectName: handoff.suggested_project
        ? (projectNames.get(handoff.suggested_project) ?? null)
        : null,
      publishedAt: handoff.published_at,
      reviewedAt: handoff.reviewed_at,
      sourceDate: handoff.source_date,
      sourceExternalId: handoff.source_external_id,
      sourceSystem: handoff.source_system,
      sourceTitle: handoff.source_title,
      sourceUrl: handoff.source_url,
      status: handoff.status as AiHandoffStatus,
      suggestedBody: handoff.suggested_body,
      suggestedDestination:
        handoff.suggested_destination as AiHandoffDestination,
      suggestedPublicUrl: handoff.suggested_public_url,
      suggestedTitle: handoff.suggested_title,
    })),
    hasError: Boolean(handoffsResult.error || projectsResult.error),
    projects: (projectsResult.data ?? []).map((project) => ({
      id: project.id,
      name: project.name,
    })),
  };
}
