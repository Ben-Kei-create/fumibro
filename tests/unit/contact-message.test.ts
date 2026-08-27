import { describe, expect, it } from "vitest";

import {
  contactMessageSchema,
  isPlausibleFormDuration,
} from "@/modules/contact/domain/contact-message";

describe("contact message", () => {
  it("accepts a valid plain-text inquiry", () => {
    expect(
      contactMessageSchema.safeParse({
        categoryId: "30000000-0000-4000-8000-000000000001",
        email: "reader@example.com",
        message: "教材について相談したいです。",
        name: "読者",
        startedAt: 1_000,
        subject: "教材",
        website: "",
      }).success,
    ).toBe(true);
  });

  it("rejects implausibly fast or stale submissions", () => {
    expect(isPlausibleFormDuration(9_000, 10_000)).toBe(false);
    expect(isPlausibleFormDuration(8_000, 10_000)).toBe(true);
    expect(isPlausibleFormDuration(1_000, 10_000_000)).toBe(false);
  });
});
