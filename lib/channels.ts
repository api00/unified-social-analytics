import { count, eq } from "drizzle-orm";
import { db } from "../db";
import { youtubeChannels } from "../db/schema";
import { hasDatabaseEnv } from "./env";

export async function countUserChannels(userId: string): Promise<number> {
  if (!hasDatabaseEnv()) return 0;

  try {
    const rows = await db
      .select({ value: count() })
      .from(youtubeChannels)
      .where(eq(youtubeChannels.userId, userId));
    return Number(rows[0]?.value ?? 0);
  } catch {
    return 0;
  }
}
