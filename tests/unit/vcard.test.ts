import { describe, expect, it } from "vitest";

import { createVCard } from "@/modules/business-card/domain/vcard";

describe("createVCard", () => {
  it("creates CRLF-delimited vCard 4.0 and escapes text", () => {
    const card = createVCard({
      address: null,
      displayName: "FUMIBRO, Editor",
      email: "hello@example.com",
      jobTitle: null,
      links: [{ label: "portfolio", url: "https://example.com/work" }],
      note: "line 1\nline 2",
      organization: "FUMIBRO",
      phone: null,
      website: "https://example.com",
    });

    expect(card).toContain("VERSION:4.0\r\n");
    expect(card).toContain("FN:FUMIBRO\\, Editor\r\n");
    expect(card).toContain("NOTE:line 1\\nline 2\r\n");
    expect(card.endsWith("END:VCARD\r\n")).toBe(true);
  });
});
