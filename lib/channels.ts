import { count, eq } from "drizzle-orm";
import { db } from "../db";
import { xAccounts, youtubeChannels } from "../db/schema";
import { hasDatabaseEnv } from "./env";
import type { SocialPlatformId } from "../types/analytics";

export type UserChannelSummary = {
  count: number;
  platforms: SocialPlatformId[];
};

export async function getUserChannelSummary(userId: string): Promise<UserChannelSummary> {
  if (!hasDatabaseEnv()) return { count: 0, platforms: [] };

  try {
    const [yt, x] = await Promise.all([
      db.select({ value: count() }).from(youtubeChannels).where(eq(youtubeChannels.userId, userId)),
      db.select({ value: count() }).from(xAccounts).where(eq(xAccounts.userId, userId)),
    ]);
    const ytCount = Number(yt[0]?.value ?? 0);
    const xCount = Number(x[0]?.value ?? 0);
    const platforms: SocialPlatformId[] = [];
    if (ytCount > 0) platforms.push("youtube");
    if (xCount > 0) platforms.push("x");
    return { count: ytCount + xCount, platforms };
  } catch {
    return { count: 0, platforms: [] };
  }
}

export async function countUserChannels(userId: string): Promise<number> {
  const summary = await getUserChannelSummary(userId);
  return summary.count;
}
