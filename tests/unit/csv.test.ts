import { describe, expect, it } from "vitest";

import { serializeCsv } from "@/modules/export/domain/csv";

describe("serializeCsv", () => {
  it("quotes values, emits a BOM, and blocks spreadsheet formulas", () => {
    const csv = serializeCsv(
      [{ body: '猫,"本"', title: '=HYPERLINK("https://evil.invalid")' }],
      ["title", "body"],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""https://evil.invalid"")"');
    expect(csv).toContain('"猫,""本"""');
  });
});
