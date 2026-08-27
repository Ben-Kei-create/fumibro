import { describe, expect, it } from "vitest";

import { commentInputSchema } from "@/modules/comments/domain/comment-input";

describe("commentInputSchema", () => {
  it("trims public text fields and preserves the honeypot", () => {
    const result = commentInputSchema.parse({
      body: "  猫の感想  ",
      displayName: "  Reader  ",
      startedAt: 1_000,
      website: "",
    });
    expect(result.body).toBe("猫の感想");
    expect(result.displayName).toBe("Reader");
  });

  it("rejects oversized comments", () => {
    expect(
      commentInputSchema.safeParse({
        body: "猫".repeat(5_001),
        displayName: "Reader",
        startedAt: 1_000,
        website: "",
      }).success,
    ).toBe(false);
  });
});
