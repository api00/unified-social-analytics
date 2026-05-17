import { google } from "googleapis";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { analyticsDaily, connectedAccounts, contentItems, syncRuns, youtubeChannels } from "../../db/schema";
import { createYouTubeOAuthClient, getYouTubeRedirectUri } from "./oauth";

export type ConnectedAccountRow = {
  id: string;
  userId: string;
  provider: "youtube";
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
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

function excluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

export async function syncYouTubeAccount(account: ConnectedAccountRow) {
  const [run] = await db
    .insert(syncRuns)
    .values({
      userId: account.userId,
      connectedAccountId: account.id,
      provider: "youtube",
      status: "running",
    })
    .returning({ id: syncRuns.id });

  try {
    if (!account.refreshToken) throw new Error("Missing YouTube refresh token. Reconnect the channel.");

    const redirectUri = getYouTubeRedirectUri();
    const oauth = createYouTubeOAuthClient(redirectUri);
    if (!oauth) throw new Error("Google OAuth credentials are not configured.");

    oauth.setCredentials({
      access_token: account.accessToken ?? undefined,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt ? account.expiresAt.getTime() : undefined,
    });

    await oauth.getAccessToken();
    await db
      .update(connectedAccounts)
      .set({
        accessToken: oauth.credentials.access_token ?? account.accessToken,
        expiresAt: oauth.credentials.expiry_date ? new Date(oauth.credentials.expiry_date) : account.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, account.id));

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

    const channelValues = {
      userId: account.userId,
      connectedAccountId: account.id,
      youtubeChannelId: channel.id,
      title: snippet?.title ?? "YouTube channel",
      handle: snippet?.customUrl ?? null,
      thumbnailUrl: snippet?.thumbnails?.default?.url ?? snippet?.thumbnails?.medium?.url ?? null,
      subscriberCount: toNumber(stats?.subscriberCount),
      viewCount: toNumber(stats?.viewCount),
      videoCount: toNumber(stats?.videoCount),
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    const [channelRow] = await db
      .insert(youtubeChannels)
      .values(channelValues)
      .onConflictDoUpdate({
        target: [youtubeChannels.userId, youtubeChannels.youtubeChannelId],
        set: channelValues,
      })
      .returning({
        id: youtubeChannels.id,
        userId: youtubeChannels.userId,
        connectedAccountId: youtubeChannels.connectedAccountId,
        youtubeChannelId: youtubeChannels.youtubeChannelId,
      });

    if (!channelRow) throw new Error("Could not upsert YouTube channel.");

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
      await db
        .insert(analyticsDaily)
        .values(dailyRows.map((row) => ({
          userId: account.userId,
          channelId: channelRow.id,
          platform: "youtube",
          date: String(row[0]),
          views: toNumber(row[1]),
          subscribersGained: toNumber(row[2]),
          subscribersLost: toNumber(row[3]),
          likes: toNumber(row[4]),
          comments: toNumber(row[5]),
          shares: toNumber(row[6]),
          estimatedMinutesWatched: String(toNumber(row[7])),
          updatedAt: new Date(),
        })))
        .onConflictDoUpdate({
          target: [analyticsDaily.userId, analyticsDaily.channelId, analyticsDaily.platform, analyticsDaily.date],
          set: {
            views: excluded("views"),
            subscribersGained: excluded("subscribers_gained"),
            subscribersLost: excluded("subscribers_lost"),
            likes: excluded("likes"),
            comments: excluded("comments"),
            shares: excluded("shares"),
            estimatedMinutesWatched: excluded("estimated_minutes_watched"),
            updatedAt: new Date(),
          },
        });
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
      await db
        .insert(contentItems)
        .values(videoRows.map((row) => {
          const externalId = String(row[0]);
          const details = detailsById.get(externalId);
          const snippetDetails = details?.snippet;
          return {
            userId: account.userId,
            channelId: channelRow.id,
            platform: "youtube",
            externalId,
            title: snippetDetails?.title ?? "Untitled YouTube video",
            contentType: "Video",
            url: `https://www.youtube.com/watch?v=${externalId}`,
            thumbnailUrl: snippetDetails?.thumbnails?.medium?.url ?? snippetDetails?.thumbnails?.default?.url ?? null,
            publishedAt: snippetDetails?.publishedAt ? new Date(snippetDetails.publishedAt) : null,
            views: toNumber(row[1]),
            engagementCount: toNumber(row[2]) + toNumber(row[3]) + toNumber(row[4]),
            rawMetrics: {
              likes: toNumber(row[2]),
              comments: toNumber(row[3]),
              shares: toNumber(row[4]),
            },
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };
        }))
        .onConflictDoUpdate({
          target: [contentItems.userId, contentItems.platform, contentItems.externalId],
          set: {
            channelId: channelRow.id,
            title: excluded("title"),
            contentType: excluded("content_type"),
            url: excluded("url"),
            thumbnailUrl: excluded("thumbnail_url"),
            publishedAt: excluded("published_at"),
            views: excluded("views"),
            engagementCount: excluded("engagement_count"),
            rawMetrics: excluded("raw_metrics"),
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    if (run?.id) {
      await db
        .update(syncRuns)
        .set({
          status: "success",
          finishedAt: new Date(),
          metadata: { dailyRows: dailyRows.length, videoRows: videoRows.length },
        })
        .where(eq(syncRuns.id, run.id));
    }

    return { ok: true, dailyRows: dailyRows.length, videoRows: videoRows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown YouTube sync error.";
    if (run?.id) {
      await db
        .update(syncRuns)
        .set({
          status: "error",
          finishedAt: new Date(),
          errorMessage: message,
        })
        .where(eq(syncRuns.id, run.id));
    }
    return { ok: false, error: message };
  }
}
