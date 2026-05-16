import { google } from "googleapis";
import { NextResponse, type NextRequest } from "next/server";
import { verifyOAuthState } from "../../../../lib/oauth-state";
import { createSupabaseServiceClient } from "../../../../lib/supabase/server";
import { createYouTubeOAuthClient, getYouTubeRedirectUri } from "../../../../lib/youtube/oauth";
import { syncYouTubeAccount, type ConnectedAccountRow } from "../../../../lib/youtube/sync";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = verifyOAuthState(requestUrl.searchParams.get("state"));
  const redirectTo = new URL("/?connected=youtube", requestUrl.origin);

  if (!code || !state) {
    redirectTo.searchParams.set("error", "youtube_oauth_failed");
    return NextResponse.redirect(redirectTo);
  }

  const supabase = createSupabaseServiceClient();
  const oauth = createYouTubeOAuthClient(getYouTubeRedirectUri(requestUrl.origin));

  if (!supabase || !oauth) {
    redirectTo.searchParams.set("error", "youtube_not_configured");
    return NextResponse.redirect(redirectTo);
  }

  try {
    const { tokens } = await oauth.getToken(code);
    oauth.setCredentials(tokens);

    const youtube = google.youtube({ version: "v3", auth: oauth });
    const channelResponse = await youtube.channels.list({
      mine: true,
      part: ["snippet", "statistics"],
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel?.id) throw new Error("No YouTube channel found.");

    const existing = await supabase
      .from("connected_accounts")
      .select("refresh_token")
      .eq("user_id", state.userId)
      .eq("provider", "youtube")
      .eq("provider_account_id", channel.id)
      .maybeSingle();

    const { data: account, error: accountError } = await supabase
      .from("connected_accounts")
      .upsert(
        {
          user_id: state.userId,
          provider: "youtube",
          provider_account_id: channel.id,
          access_token: tokens.access_token ?? null,
          refresh_token: tokens.refresh_token ?? existing.data?.refresh_token ?? null,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scopes: tokens.scope ?? null,
          raw_profile: channel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider,provider_account_id" }
      )
      .select("id,user_id,provider,provider_account_id,access_token,refresh_token,expires_at")
      .single<ConnectedAccountRow>();

    if (accountError || !account) throw new Error(accountError?.message ?? "Could not store YouTube account.");

    const stats = channel.statistics;
    const snippet = channel.snippet;

    await supabase.from("youtube_channels").upsert(
      {
        user_id: state.userId,
        connected_account_id: account.id,
        youtube_channel_id: channel.id,
        title: snippet?.title ?? "YouTube channel",
        handle: snippet?.customUrl ?? null,
        thumbnail_url: snippet?.thumbnails?.default?.url ?? snippet?.thumbnails?.medium?.url ?? null,
        subscriber_count: Number(stats?.subscriberCount ?? 0),
        view_count: Number(stats?.viewCount ?? 0),
        video_count: Number(stats?.videoCount ?? 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,youtube_channel_id" }
    );

    await syncYouTubeAccount(supabase, account);
    redirectTo.searchParams.set("status", "connected");
  } catch (error) {
    redirectTo.searchParams.set("error", error instanceof Error ? error.message : "youtube_callback_failed");
  }

  return NextResponse.redirect(redirectTo);
}
