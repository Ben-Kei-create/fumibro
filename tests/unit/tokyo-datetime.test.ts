import { describe, expect, it } from "vitest";

import {
  formatTokyoDateTimeLocal,
  parseTokyoDateTimeLocal,
} from "@/lib/datetime/tokyo";

describe("Asia/Tokyo datetime-local conversion", () => {
  it("stores a Japanese local time as an absolute instant", () => {
    expect(parseTokyoDateTimeLocal("2026-08-27T12:34")).toBe(
      "2026-08-27T03:34:00.000Z",
    );
  });

  it("formats an absolute instant for the Admin datetime-local input", () => {
    expect(formatTokyoDateTimeLocal("2026-08-27T03:34:00.000Z")).toBe(
      "2026-08-27T12:34",
    );
  });

  it("rejects calendar dates that JavaScript would otherwise normalize", () => {
    expect(() => parseTokyoDateTimeLocal("2026-02-30T10:00")).toThrow(
      /not valid/,
    );
  });
});
