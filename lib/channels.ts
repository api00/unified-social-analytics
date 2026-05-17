import { count, eq } from "drizzle-orm";
import { db } from "../db";
import { xAccounts, youtubeChannels } from "../db/schema";
import { hasDatabaseEnv } from "./env";

export async function countUserChannels(userId: string): Promise<number> {
  if (!hasDatabaseEnv()) return 0;

  try {
    const [yt, x] = await Promise.all([
      db.select({ value: count() }).from(youtubeChannels).where(eq(youtubeChannels.userId, userId)),
      db.select({ value: count() }).from(xAccounts).where(eq(xAccounts.userId, userId)),
    ]);
    return Number(yt[0]?.value ?? 0) + Number(x[0]?.value ?? 0);
  } catch {
    return 0;
  }
}
