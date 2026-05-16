import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/server";
import { syncYouTubeAccount, type ConnectedAccountRow } from "../../../../lib/youtube/sync";

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.headers.get("x-cron-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });

  const { data: accounts, error } = await supabase
    .from("connected_accounts")
    .select("id,user_id,provider,provider_account_id,access_token,refresh_token,expires_at")
    .eq("provider", "youtube")
    .returns<ConnectedAccountRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all((accounts ?? []).map((account) => syncYouTubeAccount(supabase, account)));
  return NextResponse.json({
    attempted: results.length,
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  });
}
