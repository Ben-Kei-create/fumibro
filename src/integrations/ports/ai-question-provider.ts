export type AiAnswer = Readonly<{
  answer: string;
  citations: readonly string[];
}>;

/** Phase 1 renders the question UI but has no provider implementation. */
export interface AiQuestionProvider {
  answer(question: string, contextIds: readonly string[]): Promise<AiAnswer>;
}
