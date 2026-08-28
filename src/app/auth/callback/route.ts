import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeAdminNextPath } from "@/modules/auth/domain/admin-navigation";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const nextPath = sanitizeAdminNextPath(
    request.nextUrl.searchParams.get("next"),
  );

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/login?error=invalid", request.url),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    return NextResponse.redirect(
      new URL("/admin/login?error=invalid", request.url),
    );
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
