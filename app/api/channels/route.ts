import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { formatCompactNumber } from "../../../data/analytics";
import { db } from "../../../db";
import { xAccounts, youtubeChannels } from "../../../db/schema";
import { getCurrentUser } from "../../../lib/current-user";
import type { ChannelAccount } from "../../../types/analytics";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ channels: [] }, { status: 401 });

  const [ytRows, xRows] = await Promise.all([
    db
      .select({
        id: youtubeChannels.id,
        title: youtubeChannels.title,
        handle: youtubeChannels.handle,
        subscriberCount: youtubeChannels.subscriberCount,
        viewCount: youtubeChannels.viewCount,
        videoCount: youtubeChannels.videoCount,
        lastSyncedAt: youtubeChannels.lastSyncedAt,
        thumbnailUrl: youtubeChannels.thumbnailUrl,
        createdAt: youtubeChannels.createdAt,
      })
      .from(youtubeChannels)
      .where(eq(youtubeChannels.userId, user.id))
      .orderBy(desc(youtubeChannels.createdAt)),
    db
      .select({
        id: xAccounts.id,
        username: xAccounts.username,
        name: xAccounts.name,
        followersCount: xAccounts.followersCount,
        tweetCount: xAccounts.tweetCount,
        lastSyncedAt: xAccounts.lastSyncedAt,
        profileImageUrl: xAccounts.profileImageUrl,
        createdAt: xAccounts.createdAt,
      })
      .from(xAccounts)
      .where(eq(xAccounts.userId, user.id))
      .orderBy(desc(xAccounts.createdAt)),
  ]);

  const ytChannels: ChannelAccount[] = ytRows.map((channel) => ({
    id: channel.id,
    platform: "youtube",
    name: channel.title,
    handle: channel.handle ?? "@youtube",
    status: channel.lastSyncedAt ? "Synced" : "Needs sync",
    cadence: channel.lastSyncedAt ? "Synced recently" : "Not synced yet",
    posts: Number(channel.videoCount ?? 0),
    reach: formatCompactNumber(Number(channel.viewCount ?? 0)),
    thumbnailUrl: channel.thumbnailUrl,
  }));

  const xChannels: ChannelAccount[] = xRows.map((account) => ({
    id: account.id,
    platform: "x",
    name: account.name,
    handle: `@${account.username}`,
    status: account.lastSyncedAt ? "Synced" : "Needs sync",
    cadence: account.lastSyncedAt ? "Synced recently" : "Not synced yet",
    posts: Number(account.tweetCount ?? 0),
    reach: formatCompactNumber(Number(account.followersCount ?? 0)),
    thumbnailUrl: account.profileImageUrl,
  }));

  return NextResponse.json({ channels: [...ytChannels, ...xChannels] });
}
