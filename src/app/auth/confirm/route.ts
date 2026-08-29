import { NextResponse, type NextRequest } from "next/server";

import { establishAdminRecoverySession } from "@/modules/auth/application/establish-admin-recovery-session";
import {
  ADMIN_UPDATE_PASSWORD_PATH,
  readAdminRecoveryCredential,
} from "@/modules/auth/domain/recovery-confirmation";

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest) {
  const credential = readAdminRecoveryCredential(request.nextUrl.searchParams);

  if (!credential) {
    return noStoreRedirect(
      new URL("/admin/forgot-password?error=invalid_link", request.url),
    );
  }

  const established = await establishAdminRecoverySession(credential);
  if (!established) {
    return noStoreRedirect(
      new URL("/admin/forgot-password?error=invalid_link", request.url),
    );
  }

  // Never forward the one-time token or PKCE code to the password form.
  return noStoreRedirect(new URL(ADMIN_UPDATE_PASSWORD_PATH, request.url));
}
