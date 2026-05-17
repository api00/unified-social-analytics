import { google } from "googleapis";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { connectedAccounts, youtubeChannels } from "../../../../db/schema";
import { verifyOAuthState } from "../../../../lib/oauth-state";
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

  const oauth = createYouTubeOAuthClient(getYouTubeRedirectUri(requestUrl.origin));

  if (!oauth) {
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

    const [existing] = await db
      .select({ refreshToken: connectedAccounts.refreshToken })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, state.userId),
          eq(connectedAccounts.provider, "youtube"),
          eq(connectedAccounts.providerAccountId, channel.id)
        )
      )
      .limit(1);

    const accountValues = {
      userId: state.userId,
      provider: "youtube",
      providerAccountId: channel.id,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope ?? null,
      rawProfile: channel,
      updatedAt: new Date(),
    };

    const [account] = await db
      .insert(connectedAccounts)
      .values(accountValues)
      .onConflictDoUpdate({
        target: [connectedAccounts.userId, connectedAccounts.provider, connectedAccounts.providerAccountId],
        set: accountValues,
      })
      .returning({
        id: connectedAccounts.id,
        userId: connectedAccounts.userId,
        provider: connectedAccounts.provider,
        providerAccountId: connectedAccounts.providerAccountId,
        accessToken: connectedAccounts.accessToken,
        refreshToken: connectedAccounts.refreshToken,
        expiresAt: connectedAccounts.expiresAt,
      });

    if (!account) throw new Error("Could not store YouTube account.");

    const stats = channel.statistics;
    const snippet = channel.snippet;

    await db
      .insert(youtubeChannels)
      .values({
        userId: state.userId,
        connectedAccountId: account.id,
        youtubeChannelId: channel.id,
        title: snippet?.title ?? "YouTube channel",
        handle: snippet?.customUrl ?? null,
        thumbnailUrl: snippet?.thumbnails?.default?.url ?? snippet?.thumbnails?.medium?.url ?? null,
        subscriberCount: Number(stats?.subscriberCount ?? 0),
        viewCount: Number(stats?.viewCount ?? 0),
        videoCount: Number(stats?.videoCount ?? 0),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [youtubeChannels.userId, youtubeChannels.youtubeChannelId],
        set: {
          connectedAccountId: account.id,
          title: snippet?.title ?? "YouTube channel",
          handle: snippet?.customUrl ?? null,
          thumbnailUrl: snippet?.thumbnails?.default?.url ?? snippet?.thumbnails?.medium?.url ?? null,
          subscriberCount: Number(stats?.subscriberCount ?? 0),
          viewCount: Number(stats?.viewCount ?? 0),
          videoCount: Number(stats?.videoCount ?? 0),
          updatedAt: new Date(),
        },
      });

    await syncYouTubeAccount(account as ConnectedAccountRow);
    redirectTo.searchParams.set("status", "connected");
  } catch (error) {
    redirectTo.searchParams.set("error", error instanceof Error ? error.message : "youtube_callback_failed");
  }

  return NextResponse.redirect(redirectTo);
}
