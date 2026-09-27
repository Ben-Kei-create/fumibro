import { describe, expect, it } from "vitest";

import {
  convertAiHandoffSchema,
  getAiHandoffDestinationLabel,
  getConvertedContentAdminPath,
} from "@/modules/ai-handoff/domain/ai-handoff";

describe("AI Handoff Inbox domain", () => {
  it("accepts only reviewable conversion destinations", () => {
    const base = {
      handoffId: "10000000-0000-4000-8000-000000000001",
      projectId: "",
    };

    expect(
      convertAiHandoffSchema.safeParse({ ...base, destination: "blog" })
        .success,
    ).toBe(true);
    expect(
      convertAiHandoffSchema.safeParse({ ...base, destination: "none" })
        .success,
    ).toBe(false);
    expect(
      convertAiHandoffSchema.safeParse({ ...base, destination: "published" })
        .success,
    ).toBe(false);
  });

  it("maps Portfolio to the canonical Works editor", () => {
    expect(
      getConvertedContentAdminPath(
        "portfolio",
        "20000000-0000-4000-8000-000000000001",
        null,
      ),
    ).toBe("/admin/works/20000000-0000-4000-8000-000000000001/edit");
    expect(getAiHandoffDestinationLabel("portfolio")).toBe(
      "Portfolio（Works）",
    );
  });

  it("does not create an edit link before human conversion", () => {
    expect(getConvertedContentAdminPath("blog", null, null)).toBeNull();
  });
});
