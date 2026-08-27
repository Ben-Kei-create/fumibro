import { describe, expect, it } from "vitest";

import { postEditorSchema } from "@/modules/blog/domain/post-editor";

const validInput = {
  body: "本文",
  categoryId: "",
  changeReason: "",
  contentId: "",
  expectedLockVersion: "",
  excerpt: "",
  externalUrl: "https://example.com",
  imageAssetId: "",
  isSpoiler: false,
  locationId: "",
  postedAt: "2026-08-27T12:34",
  projectId: "",
  publishAt: "",
  slug: "valid-post",
  status: "draft",
  tagIds: [],
  title: "",
  watermarkEnabled: false,
};

describe("Blog editor input", () => {
  it("normalizes optional values without inventing a title", () => {
    expect(postEditorSchema.parse(validInput)).toMatchObject({
      categoryId: null,
      contentId: null,
      externalUrl: "https://example.com",
      publishAt: null,
      title: null,
    });
  });

  it("rejects non-http external URLs", () => {
    expect(
      postEditorSchema.safeParse({
        ...validInput,
        externalUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("requires the expected lock for an edit-shaped value", () => {
    const parsed = postEditorSchema.parse({
      ...validInput,
      contentId: "11111111-1111-4111-8111-111111111111",
      expectedLockVersion: "7",
    });

    expect(parsed.expectedLockVersion).toBe(7);
  });
});
