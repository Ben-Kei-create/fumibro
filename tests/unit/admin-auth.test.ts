import { describe, expect, it } from "vitest";

import { sanitizeAdminNextPath } from "@/modules/auth/domain/admin-navigation";
import {
  getAdminSessionState,
  readSubject,
} from "@/modules/auth/domain/admin-session";

describe("admin session policy", () => {
  it("requires a trusted admin claim and AAL2", () => {
    expect(getAdminSessionState(undefined)).toBe("signed_out");
    expect(getAdminSessionState({ sub: "user-1", aal: "aal2" })).toBe(
      "forbidden",
    );
    expect(
      getAdminSessionState({
        aal: "aal2",
        app_metadata: { role: "admin" },
        is_anonymous: true,
        sub: "user-1",
      }),
    ).toBe("forbidden");
    expect(
      getAdminSessionState({
        aal: "aal1",
        app_metadata: { role: "admin" },
        sub: "user-1",
      }),
    ).toBe("mfa_required");
    expect(
      getAdminSessionState({
        aal: "aal2",
        app_metadata: { role: "admin" },
        sub: "user-1",
      }),
    ).toBe("authorized");
  });

  it("reads only a non-empty subject", () => {
    expect(readSubject({ sub: "user-1" })).toBe("user-1");
    expect(() => readSubject({ sub: "" })).toThrow(/subject/);
  });
});

describe("admin redirect targets", () => {
  it("preserves internal Admin paths and query strings", () => {
    expect(sanitizeAdminNextPath("/admin/quick?from=login")).toBe(
      "/admin/quick?from=login",
    );
  });

  it.each([
    undefined,
    "https://example.com/admin",
    "//example.com/admin",
    "/administrator",
    "/admin\\example.com",
    "/admin/login",
    "/admin/mfa",
  ])("falls back safely for %s", (value) => {
    expect(sanitizeAdminNextPath(value)).toBe("/admin");
  });
});
