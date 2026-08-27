import { z } from "zod";

export const contactMessageSchema = z.object({
  categoryId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(1).max(10_000),
  name: z.string().trim().min(1).max(120),
  startedAt: z.number().int().positive(),
  subject: z.string().trim().max(240),
  website: z.string().max(500),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export function isPlausibleFormDuration(startedAt: number, now = Date.now()) {
  const duration = now - startedAt;
  return duration >= 2_000 && duration <= 2 * 60 * 60 * 1_000;
}
