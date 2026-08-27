import { describe, expect, it } from "vitest";

import { getProjectTheme, isProjectThemeKey } from "@/themes/registry";

describe("Project theme registry", () => {
  it("allows only registered keys while rendering unknown legacy keys safely", () => {
    expect(isProjectThemeKey("default")).toBe(true);
    expect(isProjectThemeKey("../../component")).toBe(false);
    expect(getProjectTheme("../../component").key).toBe("default");
  });
});
