import { describe, expect, it } from "vitest";

describe("FUMIBRO foundation", () => {
  it("uses a deterministic test runner", () => {
    expect("FUMIBRO".toLowerCase()).toBe("fumibro");
  });
});
