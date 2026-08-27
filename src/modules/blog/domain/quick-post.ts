import { z } from "zod";

const optionalUuid = z
  .union([z.string().uuid(), z.literal("")])
  .transform((value) => (value === "" ? null : value));

export const quickPostSchema = z.object({
  body: z.string().trim().min(1).max(200_000),
  categoryId: optionalUuid,
  imageAssetId: optionalUuid,
  projectId: optionalUuid,
  publishMode: z.enum(["draft", "published"]),
  tagIds: z.array(z.string().uuid()).max(20),
  title: z.string().trim().max(240).optional(),
});

export function makeQuickPostSlug(
  now: Date = new Date(),
  uniqueToken: string = crypto.randomUUID(),
): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const suffix = uniqueToken
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);

  if (suffix.length !== 8) {
    throw new Error(
      "Quick post token must contain at least eight alphanumeric characters.",
    );
  }

  return `post-${timestamp}-${suffix}`;
}
