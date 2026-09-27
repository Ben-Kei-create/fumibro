import { z } from "zod";

export const imageLicenseTypes = [
  "personal",
  "commercial",
  "editorial",
  "all_rights_reserved",
] as const;

export const distributionClearances = [
  "cleared",
  "review_required",
  "blocked",
] as const;

export const downloadableImageStatuses = [
  "draft",
  "published",
  "hidden",
] as const;

export const imageLicenseSchema = z.enum(imageLicenseTypes);
export const distributionClearanceSchema = z.enum(distributionClearances);
export const downloadableImageStatusSchema = z.enum(downloadableImageStatuses);

export type ImageLicenseType = z.infer<typeof imageLicenseSchema>;
export type DistributionClearance = z.infer<typeof distributionClearanceSchema>;
export type DownloadableImageStatus = z.infer<
  typeof downloadableImageStatusSchema
>;

export const downloadableImageInputSchema = z
  .object({
    adsEnabled: z.boolean(),
    assetId: z.string().uuid(),
    description: z.string().trim().min(1).max(200_000),
    distributionClearance: distributionClearanceSchema,
    downloadAssetId: z.string().uuid(),
    downloadEnabled: z.boolean(),
    expectedLockVersion: z.number().int().positive().nullable(),
    id: z.string().uuid().nullable(),
    licenseType: imageLicenseSchema,
    projectId: z.string().uuid().nullable(),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    sourceSystem: z.string().trim().min(1).max(80),
    sourceWorkTitle: z.string().trim().max(240),
    status: downloadableImageStatusSchema,
    tagIds: z.array(z.string().uuid()).max(20),
    title: z.string().trim().min(1).max(240),
    useExamples: z.string().trim().max(20_000),
  })
  .superRefine((value, context) => {
    if (value.status === "published") {
      if (value.distributionClearance !== "cleared") {
        context.addIssue({
          code: "custom",
          message: "公開には配布権利の確認が必要です。",
          path: ["distributionClearance"],
        });
      }
      if (value.description.length < 40 || value.useExamples.length < 10) {
        context.addIssue({
          code: "custom",
          message: "公開前に固有の説明と用途例を記入してください。",
          path: ["description"],
        });
      }
    }
  });

export function imageLicenseLabel(value: ImageLicenseType): string {
  return {
    all_rights_reserved: "無断利用不可",
    commercial: "商用利用可",
    editorial: "編集・報道用途",
    personal: "個人利用可",
  }[value];
}

export function clearanceLabel(value: DistributionClearance): string {
  return {
    blocked: "配布不可",
    cleared: "配布確認済み",
    review_required: "要確認",
  }[value];
}
