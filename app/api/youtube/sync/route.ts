import { NextResponse } from "next/server";
import { createSupabaseServiceClient, getAuthenticatedUser } from "../../../../lib/supabase/server";
import { syncYouTubeAccount, type ConnectedAccountRow } from "../../../../lib/youtube/sync";

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Sign in before syncing YouTube." }, { status: 401 });

  const supabase = createSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });

  const { data: accounts, error } = await supabase
    .from("connected_accounts")
    .select("id,user_id,provider,provider_account_id,access_token,refresh_token,expires_at")
    .eq("user_id", user.id)
    .eq("provider", "youtube")
    .returns<ConnectedAccountRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!accounts?.length) return NextResponse.json({ synced: 0 });

  const results = await Promise.all(accounts.map((account) => syncYouTubeAccount(supabase, account)));
  const failed = results.find((result) => !result.ok);
  if (failed && "error" in failed) return NextResponse.json({ error: failed.error, synced: 0 }, { status: 502 });

  return NextResponse.json({ synced: results.length });
}
