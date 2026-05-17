import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { formatCompactNumber } from "../../../data/analytics";
import { db } from "../../../db";
import { youtubeChannels } from "../../../db/schema";
import { getCurrentUser } from "../../../lib/current-user";
import type { ChannelAccount } from "../../../types/analytics";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ channels: [] }, { status: 401 });

  const data = await db
    .select({
      id: youtubeChannels.id,
      title: youtubeChannels.title,
      handle: youtubeChannels.handle,
      subscriberCount: youtubeChannels.subscriberCount,
      viewCount: youtubeChannels.viewCount,
      videoCount: youtubeChannels.videoCount,
      lastSyncedAt: youtubeChannels.lastSyncedAt,
      thumbnailUrl: youtubeChannels.thumbnailUrl,
    })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.userId, user.id))
    .orderBy(desc(youtubeChannels.createdAt));

  const channels: ChannelAccount[] = data.map((channel) => ({
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

  return NextResponse.json({ channels });
}
