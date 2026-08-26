export const externalContentSourceSystems = [
  "gmail",
  "chatgpt",
  "claude",
  "gemini",
  "kdp",
  "import",
] as const;

export type ExternalContentSourceSystem =
  (typeof externalContentSourceSystems)[number];

export type ImportCandidate = Readonly<{
  sourceSystem: ExternalContentSourceSystem;
  sourceExternalId: string;
  suggestedKind: "post" | "work" | "library" | "page";
  title: string | null;
  body: string;
  occurredAt: string | null;
  rawMetadata: Readonly<Record<string, unknown>>;
}>;

/**
 * Phase 1 boundary only. Providers and the human-reviewed AI Handoff Inbox are
 * deliberately deferred to Phase 2. Implementations must never publish or
 * write to content_items directly.
 */
export interface ContentImportProvider {
  readonly sourceSystem: ExternalContentSourceSystem;
  listCandidates(cursor?: string): Promise<
    Readonly<{
      candidates: readonly ImportCandidate[];
      nextCursor: string | null;
    }>
  >;
}
