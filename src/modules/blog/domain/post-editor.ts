import { z } from "zod";

const optionalUuid = z
  .union([z.string().uuid(), z.literal("")])
  .transform((value) => (value === "" ? null : value));

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => value || null);

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => {
      if (value === "") {
        return true;
      }

      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must be an absolute http or https URL." },
  )
  .transform((value) => value || null);

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const postEditorSchema = z
  .object({
    body: z.string().trim().min(1).max(200_000),
    categoryId: optionalUuid,
    changeReason: optionalText(1000),
    contentId: optionalUuid,
    expectedLockVersion: z
      .union([z.coerce.number().int().positive(), z.literal("")])
      .transform((value) => (value === "" ? null : value)),
    excerpt: optionalText(1000),
    externalUrl: optionalHttpUrl,
    imageAssetId: optionalUuid,
    isSpoiler: z.boolean(),
    locationId: optionalUuid,
    postedAt: localDateTime,
    projectId: optionalUuid,
    publishAt: z
      .union([localDateTime, z.literal("")])
      .transform((value) => value || null),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: z.enum(["draft", "published", "hidden"]),
    tagIds: z.array(z.string().uuid()).max(20),
    title: optionalText(240),
    watermarkEnabled: z.boolean(),
  })
  .superRefine((value, context) => {
    if ((value.contentId === null) !== (value.expectedLockVersion === null)) {
      context.addIssue({
        code: "custom",
        message: "Content ID and lock version must be provided together.",
        path: ["expectedLockVersion"],
      });
    }
  });

export type PostEditorInput = z.infer<typeof postEditorSchema>;

export type PostEditorValues = {
  body: string;
  categoryId: string | null;
  changeReason: string | null;
  contentId: string | null;
  expectedLockVersion: number | null;
  excerpt: string | null;
  externalUrl: string | null;
  imageAssetId: string | null;
  isSpoiler: boolean;
  locationId: string | null;
  postedAt: string;
  projectId: string | null;
  publishAt: string | null;
  slug: string;
  status: "draft" | "published" | "hidden";
  tagIds: string[];
  title: string | null;
  watermarkEnabled: boolean;
};
