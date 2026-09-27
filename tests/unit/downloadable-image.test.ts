import { describe, expect, it } from "vitest";

import {
  downloadableImageInputSchema,
  imageLicenseLabel,
} from "@/modules/images/domain/downloadable-image";

const base = {
  adsEnabled: false,
  assetId: "92000000-0000-4000-8000-000000000010",
  description:
    "この画像だけの内容と背景を詳しく説明した、検索利用者にも意味が伝わる十分な長さの日本語テキストです。",
  distributionClearance: "cleared" as const,
  downloadAssetId: "92000000-0000-4000-8000-000000000010",
  downloadEnabled: true,
  expectedLockVersion: 1,
  id: "93000000-0000-4000-8000-000000000010",
  licenseType: "personal" as const,
  projectId: null,
  publishedAt: "2026-09-14T06:00:00.000Z",
  slug: "sample-image",
  sourceSystem: "manual",
  sourceWorkTitle: "",
  status: "published" as const,
  tagIds: [],
  title: "サンプル画像",
  useExamples: "教材やブログ記事の挿絵として使えます。",
};

describe("downloadable image input", () => {
  it("accepts a cleared, substantive published image", () => {
    expect(downloadableImageInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects publishing before clearance", () => {
    const result = downloadableImageInputSchema.safeParse({
      ...base,
      distributionClearance: "review_required",
    });
    expect(result.success).toBe(false);
  });

  it("rejects thin published pages", () => {
    const result = downloadableImageInputSchema.safeParse({
      ...base,
      description: "短い",
      useExamples: "短い",
    });
    expect(result.success).toBe(false);
  });

  it("labels licenses for public display", () => {
    expect(imageLicenseLabel("commercial")).toBe("商用利用可");
    expect(imageLicenseLabel("all_rights_reserved")).toBe("無断利用不可");
  });
});
