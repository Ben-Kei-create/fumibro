import { describe, expect, it } from "vitest";

import {
  makeQuickPostSlug,
  quickPostSchema,
} from "@/modules/blog/domain/quick-post";

describe("Quick post input", () => {
  it("normalizes optional relations and text", () => {
    const input = quickPostSchema.parse({
      body: "  今日の記録  ",
      categoryId: "",
      imageAssetId: "",
      projectId: "",
      publishMode: "published",
      tagIds: ["11111111-1111-4111-8111-111111111111"],
      title: "  日記  ",
    });

    expect(input).toEqual({
      body: "今日の記録",
      categoryId: null,
      imageAssetId: null,
      projectId: null,
      publishMode: "published",
      tagIds: ["11111111-1111-4111-8111-111111111111"],
      title: "日記",
    });
  });

  it("rejects an empty body and too many tags", () => {
    const result = quickPostSchema.safeParse({
      body: "   ",
      categoryId: "",
      imageAssetId: "",
      projectId: "",
      publishMode: "draft",
      tagIds: Array.from(
        { length: 21 },
        (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      ),
      title: "",
    });

    expect(result.success).toBe(false);
  });

  it("builds a lowercase deterministic slug from safe components", () => {
    expect(
      makeQuickPostSlug(new Date("2026-08-27T12:34:56.000Z"), "ABCD-1234-safe"),
    ).toBe("post-20260827123456-abcd1234");
  });
});
