import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  analyticsDaily,
  connectedAccounts,
  contentItems,
  syncRuns,
  xAccounts,
} from "../../db/schema";
import { refreshAccessToken } from "./oauth";

export type XConnectedAccount = {
  id: string;
  userId: string;
  provider: "x";
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
};

type XUser = {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
};

type XMedia = {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  duration_ms?: number;
};

type XTweet = {
  id: string;
  text: string;
  created_at: string;
  attachments?: { media_keys?: string[] };
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count?: number;
    impression_count?: number;
  };
};

type XTweetsResponse = {
  data?: XTweet[];
  includes?: { media?: XMedia[] };
};

function classifyTweet(tweet: XTweet, mediaByKey: Map<string, XMedia>) {
  const keys = tweet.attachments?.media_keys ?? [];
  if (!keys.length) return "Text";
  const types = keys.map((k) => mediaByKey.get(k)?.type).filter(Boolean) as XMedia["type"][];
  if (types.includes("video")) return "Video";
  if (types.includes("animated_gif")) return "GIF";
  if (types.includes("photo")) return "Image";
  return "Text";
}

function excluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

export async function fetchXMe(accessToken: string): Promise<XUser> {
  const url = new URL("https://api.twitter.com/2/users/me");
  url.searchParams.set(
    "user.fields",
    "created_at,description,profile_image_url,public_metrics,verified"
  );

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X /users/me failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as { data: XUser };
  return json.data;
}

async function fetchUserTweets(
  accessToken: string,
  userId: string
): Promise<{ tweets: XTweet[]; mediaByKey: Map<string, XMedia> }> {
  const url = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
  url.searchParams.set("max_results", "100");
  url.searchParams.set("tweet.fields", "public_metrics,created_at,attachments");
  url.searchParams.set("expansions", "attachments.media_keys");
  url.searchParams.set("media.fields", "type,duration_ms");
  url.searchParams.set("exclude", "retweets,replies");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X /users/:id/tweets failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as XTweetsResponse;
  const tweets = json.data ?? [];
  const mediaByKey = new Map<string, XMedia>();
  for (const media of json.includes?.media ?? []) {
    mediaByKey.set(media.media_key, media);
  }
  return { tweets, mediaByKey };
}

async function refreshIfNeeded(account: XConnectedAccount): Promise<string> {
  const buffer = 60_000;
  const isExpired =
    !account.accessToken ||
    (account.expiresAt && account.expiresAt.getTime() - Date.now() < buffer);

  if (!isExpired) return account.accessToken as string;

  if (!account.refreshToken) {
    throw new Error("X access token expired and no refresh token is stored. Reconnect X.");
  }

  const fresh = await refreshAccessToken(account.refreshToken);
  await db
    .update(connectedAccounts)
    .set({
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token ?? account.refreshToken,
      expiresAt: fresh.expires_in ? new Date(Date.now() + fresh.expires_in * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(connectedAccounts.id, account.id));

  return fresh.access_token;
}

export async function syncXAccount(account: XConnectedAccount) {
  const [run] = await db
    .insert(syncRuns)
    .values({
      userId: account.userId,
      connectedAccountId: account.id,
      provider: "x",
      status: "running",
    })
    .returning({ id: syncRuns.id });

  try {
    const accessToken = await refreshIfNeeded(account);
    const me = await fetchXMe(accessToken);

    const metrics = me.public_metrics ?? {
      followers_count: 0,
      following_count: 0,
      tweet_count: 0,
      listed_count: 0,
    };

    const accountValues = {
      userId: account.userId,
      connectedAccountId: account.id,
      xUserId: me.id,
      username: me.username,
      name: me.name,
      profileImageUrl: me.profile_image_url ?? null,
      description: me.description ?? null,
      followersCount: metrics.followers_count ?? 0,
      followingCount: metrics.following_count ?? 0,
      tweetCount: metrics.tweet_count ?? 0,
      listedCount: metrics.listed_count ?? 0,
      verified: Boolean(me.verified),
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    const [xAccountRow] = await db
      .insert(xAccounts)
      .values(accountValues)
      .onConflictDoUpdate({
        target: [xAccounts.userId, xAccounts.xUserId],
        set: accountValues,
      })
      .returning({ id: xAccounts.id });

    if (!xAccountRow) throw new Error("Could not upsert X account.");

    const { tweets, mediaByKey } = await fetchUserTweets(accessToken, me.id);

    if (tweets.length) {
      await db
        .insert(contentItems)
        .values(
          tweets.map((tweet) => {
            const metrics = tweet.public_metrics ?? {
              retweet_count: 0,
              reply_count: 0,
              like_count: 0,
              quote_count: 0,
              impression_count: 0,
            };
            return {
              userId: account.userId,
              xAccountId: xAccountRow.id,
              platform: "x" as const,
              externalId: tweet.id,
              title: tweet.text.slice(0, 280),
              contentType: classifyTweet(tweet, mediaByKey),
              url: `https://twitter.com/${me.username}/status/${tweet.id}`,
              thumbnailUrl: null,
              publishedAt: new Date(tweet.created_at),
              views: metrics.impression_count ?? 0,
              engagementCount:
                (metrics.like_count ?? 0) +
                (metrics.retweet_count ?? 0) +
                (metrics.reply_count ?? 0) +
                (metrics.quote_count ?? 0),
              rawMetrics: metrics as unknown as Record<string, unknown>,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            };
          })
        )
        .onConflictDoUpdate({
          target: [contentItems.userId, contentItems.platform, contentItems.externalId],
          set: {
            title: excluded("title"),
            contentType: excluded("content_type"),
            url: excluded("url"),
            publishedAt: excluded("published_at"),
            views: excluded("views"),
            engagementCount: excluded("engagement_count"),
            rawMetrics: excluded("raw_metrics"),
            xAccountId: xAccountRow.id,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    const daily = aggregateDaily(tweets);
    if (daily.length) {
      await db
        .insert(analyticsDaily)
        .values(
          daily.map((row) => ({
            userId: account.userId,
            xAccountId: xAccountRow.id,
            platform: "x" as const,
            date: row.date,
            views: row.views,
            likes: row.likes,
            comments: row.replies,
            shares: row.retweets + row.quotes,
            estimatedMinutesWatched: "0",
            source: "x",
            updatedAt: new Date(),
          }))
        )
        .onConflictDoUpdate({
          target: [
            analyticsDaily.userId,
            analyticsDaily.channelId,
            analyticsDaily.platform,
            analyticsDaily.date,
          ],
          set: {
            views: excluded("views"),
            likes: excluded("likes"),
            comments: excluded("comments"),
            shares: excluded("shares"),
            xAccountId: xAccountRow.id,
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
          metadata: { tweetCount: tweets.length, dailyRows: daily.length },
        })
        .where(eq(syncRuns.id, run.id));
    }

    return { ok: true as const, tweetCount: tweets.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown X sync error.";
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
    return { ok: false as const, error: message };
  }
}

function aggregateDaily(tweets: XTweet[]) {
  const buckets = new Map<
    string,
    { date: string; views: number; likes: number; replies: number; retweets: number; quotes: number }
  >();

  for (const tweet of tweets) {
    const date = tweet.created_at.slice(0, 10);
    const metrics = tweet.public_metrics ?? {
      retweet_count: 0,
      reply_count: 0,
      like_count: 0,
      quote_count: 0,
      impression_count: 0,
    };
    const bucket = buckets.get(date) ?? { date, views: 0, likes: 0, replies: 0, retweets: 0, quotes: 0 };
    bucket.views += metrics.impression_count ?? 0;
    bucket.likes += metrics.like_count ?? 0;
    bucket.replies += metrics.reply_count ?? 0;
    bucket.retweets += metrics.retweet_count ?? 0;
    bucket.quotes += metrics.quote_count ?? 0;
    buckets.set(date, bucket);
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function syncAllXAccountsForUser(userId: string) {
  const accounts = await db
    .select({
      id: connectedAccounts.id,
      userId: connectedAccounts.userId,
      provider: connectedAccounts.provider,
      providerAccountId: connectedAccounts.providerAccountId,
      accessToken: connectedAccounts.accessToken,
      refreshToken: connectedAccounts.refreshToken,
      expiresAt: connectedAccounts.expiresAt,
    })
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.provider, "x")));

  const results = await Promise.all(
    accounts.map((account) =>
      syncXAccount({
        id: account.id,
        userId: account.userId,
        provider: "x",
        providerAccountId: account.providerAccountId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        expiresAt: account.expiresAt,
      })
    )
  );

  return { attempted: results.length, ok: results.filter((r) => r.ok).length };
}
