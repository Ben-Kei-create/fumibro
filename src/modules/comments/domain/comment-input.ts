import { z } from "zod";

export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  displayName: z.string().trim().min(1).max(80),
  startedAt: z.number().int().positive(),
  website: z.string().max(500),
});
