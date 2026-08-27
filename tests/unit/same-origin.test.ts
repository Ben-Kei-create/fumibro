import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "@/lib/http/same-origin";

describe("same-origin mutation guard", () => {
  it("accepts the exact request origin", () => {
    const request = new Request(
      "https://fumibro.example/api/admin/uploads/init",
      {
        headers: { origin: "https://fumibro.example" },
        method: "POST",
      },
    );

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects missing and cross-site origins", () => {
    expect(
      isSameOriginRequest(
        new Request("https://fumibro.example/api", { method: "POST" }),
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        new Request("https://fumibro.example/api", {
          headers: { origin: "https://attacker.example" },
          method: "POST",
        }),
      ),
    ).toBe(false);
  });
});
