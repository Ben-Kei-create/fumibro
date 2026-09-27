import { describe, expect, it } from "vitest";

import {
  getCanonicalAdminUrl,
  readForwardedRequestOrigin,
} from "@/modules/auth/domain/canonical-admin-url";

const canonicalSiteUrl = "https://fumibro-git-codex-preview.example.vercel.app";

describe("canonical Admin origin", () => {
  it("moves Admin pages from a unique deployment hostname", () => {
    const target = getCanonicalAdminUrl(
      new URL(
        "https://fumibro-unique.example.vercel.app/admin/forgot-password?error=invalid_link",
      ),
      canonicalSiteUrl,
    );

    expect(target?.toString()).toBe(
      `${canonicalSiteUrl}/admin/forgot-password?error=invalid_link`,
    );
  });

  it("moves recovery callbacks while preserving one-time query parameters", () => {
    const target = getCanonicalAdminUrl(
      new URL(
        "https://fumibro-unique.example.vercel.app/auth/confirm?code=one-time&next=%2Fadmin%2Fupdate-password",
      ),
      canonicalSiteUrl,
    );

    expect(target?.toString()).toBe(
      `${canonicalSiteUrl}/auth/confirm?code=one-time&next=%2Fadmin%2Fupdate-password`,
    );
  });

  it("does not redirect the canonical host or public pages", () => {
    expect(
      getCanonicalAdminUrl(
        new URL(`${canonicalSiteUrl}/admin/login`),
        canonicalSiteUrl,
      ),
    ).toBeNull();
    expect(
      getCanonicalAdminUrl(
        new URL("https://fumibro-unique.example.vercel.app/blog"),
        canonicalSiteUrl,
      ),
    ).toBeNull();
  });

  it("uses the browser-facing host instead of Next's internal URL", () => {
    const internalUrl = new URL("http://localhost:3000/admin/login");
    const headers = new Headers({
      host: "127.0.0.1:3100",
      "x-forwarded-proto": "http",
    });

    const requestOrigin = readForwardedRequestOrigin(internalUrl, headers);
    expect(requestOrigin).toBe("http://127.0.0.1:3100");
    expect(
      getCanonicalAdminUrl(internalUrl, "http://127.0.0.1:3100", requestOrigin),
    ).toBeNull();
  });
});
