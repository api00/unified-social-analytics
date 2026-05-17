import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { connectedAccounts } from "../../../../db/schema";
import { getCurrentUser } from "../../../../lib/current-user";
import { syncYouTubeAccount, type ConnectedAccountRow } from "../../../../lib/youtube/sync";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before syncing YouTube." }, { status: 401 });

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
    .where(and(eq(connectedAccounts.userId, user.id), eq(connectedAccounts.provider, "youtube")));

  if (!accounts.length) return NextResponse.json({ synced: 0 });

  const results = await Promise.all(accounts.map((account) => syncYouTubeAccount(account as ConnectedAccountRow)));
  const failed = results.find((result) => !result.ok);
  if (failed && "error" in failed) return NextResponse.json({ error: failed.error, synced: 0 }, { status: 502 });

  return NextResponse.json({ synced: results.length });
}
