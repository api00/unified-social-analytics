import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../db";
import { connectedAccounts } from "../../../../db/schema";
import { syncYouTubeAccount, type ConnectedAccountRow } from "../../../../lib/youtube/sync";

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.headers.get("x-cron-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

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
    .where(eq(connectedAccounts.provider, "youtube"));

  const results = await Promise.all(accounts.map((account) => syncYouTubeAccount(account as ConnectedAccountRow)));
  return NextResponse.json({
    attempted: results.length,
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  });
}
