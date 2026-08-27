import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  hasExpectedLibraryMagic,
  sanitizeLibraryFilename,
} from "@/modules/library-files/domain/download-policy";

describe("Library download policy", () => {
  it("accepts PDF and ZIP signatures and rejects mismatches", () => {
    expect(
      hasExpectedLibraryMagic(Buffer.from("%PDF-1.7"), "application/pdf"),
    ).toBe(true);
    expect(
      hasExpectedLibraryMagic(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        "application/zip",
      ),
    ).toBe(true);
    expect(
      hasExpectedLibraryMagic(Buffer.from("not a pdf"), "application/pdf"),
    ).toBe(false);
  });

  it("removes path separators and controls from display filenames", () => {
    expect(sanitizeLibraryFilename("../教材\\猫\u0000.pdf")).toBe(
      ".._教材_猫_.pdf",
    );
  });
});
