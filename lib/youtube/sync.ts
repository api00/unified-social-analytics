import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createYouTubeOAuthClient, getYouTubeRedirectUri } from "./oauth";

export type ConnectedAccountRow = {
  id: string;
  user_id: string;
  provider: "youtube";
  provider_account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

type YouTubeChannelRow = {
  id: string;
  user_id: string;
  connected_account_id: string;
  youtube_channel_id: string;
};

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function syncYouTubeAccount(supabase: SupabaseClient, account: ConnectedAccountRow) {
  const startedAt = new Date().toISOString();
  const { data: run } = await supabase
    .from("sync_runs")
    .insert({
      user_id: account.user_id,
      connected_account_id: account.id,
      provider: "youtube",
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();

  try {
    if (!account.refresh_token) throw new Error("Missing YouTube refresh token. Reconnect the channel.");

    const redirectUri = getYouTubeRedirectUri();
    const oauth = createYouTubeOAuthClient(redirectUri);
    if (!oauth) throw new Error("Google OAuth credentials are not configured.");

    oauth.setCredentials({
      access_token: account.access_token ?? undefined,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? new Date(account.expires_at).getTime() : undefined,
    });

    await oauth.getAccessToken();

    const youtube = google.youtube({ version: "v3", auth: oauth });
    const analytics = google.youtubeAnalytics({ version: "v2", auth: oauth });

    const channelResponse = await youtube.channels.list({
      mine: true,
      part: ["snippet", "statistics"],
    });
    const channel = channelResponse.data.items?.[0];
    if (!channel?.id) throw new Error("No YouTube channel was found for this Google account.");

    const stats = channel.statistics;
    const snippet = channel.snippet;

    const { data: channelRow, error: channelError } = await supabase
      .from("youtube_channels")
      .upsert(
        {
          user_id: account.user_id,
          connected_account_id: account.id,
          youtube_channel_id: channel.id,
          title: snippet?.title ?? "YouTube channel",
          handle: snippet?.customUrl ?? null,
          thumbnail_url: snippet?.thumbnails?.default?.url ?? snippet?.thumbnails?.medium?.url ?? null,
          subscriber_count: toNumber(stats?.subscriberCount),
          view_count: toNumber(stats?.viewCount),
          video_count: toNumber(stats?.videoCount),
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,youtube_channel_id" }
      )
      .select("id,user_id,connected_account_id,youtube_channel_id")
      .single<YouTubeChannelRow>();

    if (channelError || !channelRow) throw new Error(channelError?.message ?? "Could not upsert YouTube channel.");

    const startDate = dateDaysAgo(6);
    const endDate = dateDaysAgo(0);

    const dailyReport = await analytics.reports.query({
      ids: "channel==MINE",
      startDate,
      endDate,
      dimensions: "day",
      metrics: "views,subscribersGained,subscribersLost,likes,comments,shares,estimatedMinutesWatched",
      sort: "day",
    });

    const dailyRows = (dailyReport.data.rows ?? []) as unknown[][];
    if (dailyRows.length) {
      await supabase.from("analytics_daily").upsert(
        dailyRows.map((row) => ({
          user_id: account.user_id,
          channel_id: channelRow.id,
          platform: "youtube",
          date: String(row[0]),
          views: toNumber(row[1]),
          subscribers_gained: toNumber(row[2]),
          subscribers_lost: toNumber(row[3]),
          likes: toNumber(row[4]),
          comments: toNumber(row[5]),
          shares: toNumber(row[6]),
          estimated_minutes_watched: toNumber(row[7]),
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,channel_id,platform,date" }
      );
    }

    const videoReport = await analytics.reports.query({
      ids: "channel==MINE",
      startDate,
      endDate,
      dimensions: "video",
      metrics: "views,likes,comments,shares",
      sort: "-views",
      maxResults: 10,
    });

    const videoRows = (videoReport.data.rows ?? []) as unknown[][];
    const videoIds = videoRows.map((row) => String(row[0])).filter(Boolean);
    const videoDetails = videoIds.length
      ? await youtube.videos.list({ id: videoIds, part: ["snippet"] })
      : null;
    const detailsById = new Map(
      (videoDetails?.data.items ?? []).map((video) => [video.id, video])
    );

    if (videoRows.length) {
      await supabase.from("content_items").upsert(
        videoRows.map((row) => {
          const externalId = String(row[0]);
          const details = detailsById.get(externalId);
          const snippetDetails = details?.snippet;
          return {
            user_id: account.user_id,
            channel_id: channelRow.id,
            platform: "youtube",
            external_id: externalId,
            title: snippetDetails?.title ?? "Untitled YouTube video",
            content_type: "Video",
            url: `https://www.youtube.com/watch?v=${externalId}`,
            thumbnail_url: snippetDetails?.thumbnails?.medium?.url ?? snippetDetails?.thumbnails?.default?.url ?? null,
            published_at: snippetDetails?.publishedAt ?? null,
            views: toNumber(row[1]),
            engagement_count: toNumber(row[2]) + toNumber(row[3]) + toNumber(row[4]),
            raw_metrics: {
              likes: toNumber(row[2]),
              comments: toNumber(row[3]),
              shares: toNumber(row[4]),
            },
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }),
        { onConflict: "user_id,platform,external_id" }
      );
    }

    await supabase
      .from("sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        metadata: { dailyRows: dailyRows.length, videoRows: videoRows.length },
      })
      .eq("id", run?.id);

    return { ok: true, dailyRows: dailyRows.length, videoRows: videoRows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown YouTube sync error.";
    await supabase
      .from("sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", run?.id);
    return { ok: false, error: message };
  }
}
