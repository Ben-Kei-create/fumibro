import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth })),
}));

import { establishAdminRecoverySession } from "@/modules/auth/application/establish-admin-recovery-session";
import { readAdminRecoveryCredential } from "@/modules/auth/domain/recovery-confirmation";

describe("admin recovery credential parsing", () => {
  it("prefers a recovery token hash", () => {
    const parameters = new URLSearchParams({
      token_hash: "hashed-token",
      type: "recovery",
    });

    expect(readAdminRecoveryCredential(parameters)).toEqual({
      kind: "token_hash",
      tokenHash: "hashed-token",
    });
  });

  it("rejects token hashes for other email actions", () => {
    const parameters = new URLSearchParams({
      code: "must-not-fall-back",
      token_hash: "hashed-token",
      type: "signup",
    });

    expect(readAdminRecoveryCredential(parameters)).toBeNull();
  });

  it("keeps PKCE as a compatibility credential", () => {
    const parameters = new URLSearchParams({
      code: "pkce-code",
      sb_flow_id: "flow-id",
    });

    expect(readAdminRecoveryCredential(parameters)).toEqual({
      code: "pkce-code",
      flowId: "flow-id",
      kind: "pkce",
    });
  });
});

describe("admin recovery session establishment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.verifyOtp.mockResolvedValue({ error: null });
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({
      data: { user: { app_metadata: { role: "admin" } } },
      error: null,
    });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it("uses verifyOtp for the primary SSR recovery flow", async () => {
    await expect(
      establishAdminRecoverySession({
        kind: "token_hash",
        tokenHash: "hashed-token",
      }),
    ).resolves.toBe(true);

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hashed-token",
      type: "recovery",
    });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("supports PKCE only as a compatibility fallback", async () => {
    await expect(
      establishAdminRecoverySession({
        code: "pkce-code",
        flowId: "flow-id",
        kind: "pkce",
      }),
    ).resolves.toBe(true);

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code", {
      flowId: "flow-id",
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("discards a recovered session without trusted Admin metadata", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { app_metadata: {} } },
      error: null,
    });

    await expect(
      establishAdminRecoverySession({
        kind: "token_hash",
        tokenHash: "hashed-token",
      }),
    ).resolves.toBe(false);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
