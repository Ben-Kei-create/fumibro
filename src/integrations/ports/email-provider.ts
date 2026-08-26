export type EmailMessage = Readonly<{
  to: string;
  subject: string;
  text: string;
}>;

/** Email delivery is intentionally unavailable in Phase 1. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}
