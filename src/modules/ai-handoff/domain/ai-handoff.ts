import { z } from "zod";

export const aiHandoffStatuses = [
  "pending",
  "approved",
  "published",
  "ignored",
  "error",
] as const;

export const aiHandoffDestinations = [
  "blog",
  "works",
  "library",
  "portfolio",
  "notice",
  "none",
] as const;

export const convertibleAiHandoffDestinations = [
  "blog",
  "works",
  "library",
  "portfolio",
  "notice",
] as const;

export type AiHandoffStatus = (typeof aiHandoffStatuses)[number];
export type AiHandoffDestination = (typeof aiHandoffDestinations)[number];
export type ConvertibleAiHandoffDestination =
  (typeof convertibleAiHandoffDestinations)[number];

export const aiHandoffStatusSchema = z.enum(aiHandoffStatuses);
export const convertAiHandoffSchema = z.object({
  destination: z.enum(convertibleAiHandoffDestinations),
  handoffId: z.string().uuid(),
  projectId: z.union([z.literal(""), z.string().uuid()]),
});

export function getAiHandoffDestinationLabel(
  destination: AiHandoffDestination,
): string {
  const labels: Record<AiHandoffDestination, string> = {
    blog: "Blog",
    library: "Library",
    none: "未判定",
    notice: "掲示板",
    portfolio: "Portfolio（Works）",
    works: "Works",
  };

  return labels[destination];
}

export function getConvertedContentAdminPath(
  destination: AiHandoffDestination,
  contentItemId: string | null,
  noticeId: string | null,
): string | null {
  if (noticeId && destination === "notice") return "/admin/notices";
  if (!contentItemId) return null;
  if (destination === "blog") return `/admin/posts/${contentItemId}/edit`;
  if (destination === "library") return `/admin/library/${contentItemId}/edit`;
  if (destination === "works" || destination === "portfolio")
    return `/admin/works/${contentItemId}/edit`;
  return null;
}
