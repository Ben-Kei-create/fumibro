import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnvironment } from "@/lib/env/public";

const ADMIN_LOGIN_PATH = "/admin/login";
const ADMIN_MFA_PATH = "/admin/mfa";
const ADMIN_FORGOT_PASSWORD_PATH = "/admin/forgot-password";
const ADMIN_UPDATE_PASSWORD_PATH = "/admin/update-password";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const environment = getPublicEnvironment();

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAuthenticationPath =
    pathname === ADMIN_LOGIN_PATH ||
    pathname === ADMIN_MFA_PATH ||
    pathname === ADMIN_FORGOT_PASSWORD_PATH ||
    pathname === ADMIN_UPDATE_PASSWORD_PATH;

  if (isAdminPath && !isAuthenticationPath && !data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = ADMIN_LOGIN_PATH;
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
