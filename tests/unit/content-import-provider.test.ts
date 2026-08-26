import { describe, expect, it } from "vitest";

import { externalContentSourceSystems } from "@/integrations/ports/content-import-provider";

describe("content import provider boundary", () => {
  it("reserves every approved external source without implementing ingestion", () => {
    expect(externalContentSourceSystems).toEqual([
      "gmail",
      "chatgpt",
      "claude",
      "gemini",
      "kdp",
      "import",
    ]);
  });
});
