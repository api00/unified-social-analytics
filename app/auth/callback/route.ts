import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, ensureUserProfile } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await ensureUserProfile(user);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
