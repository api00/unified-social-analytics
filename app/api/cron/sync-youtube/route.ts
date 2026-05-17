import { NextResponse, type NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../../../db";
import { connectedAccounts } from "../../../../db/schema";
import { syncYouTubeAccount, type ConnectedAccountRow } from "../../../../lib/youtube/sync";
import { syncXAccount } from "../../../../lib/x/sync";

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
    .where(inArray(connectedAccounts.provider, ["youtube", "x"]));

  const results = await Promise.all(
    accounts.map((account) => {
      if (account.provider === "youtube") {
        return syncYouTubeAccount(account as ConnectedAccountRow);
      }
      if (account.provider === "x") {
        return syncXAccount({
          id: account.id,
          userId: account.userId,
          provider: "x",
          providerAccountId: account.providerAccountId,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          expiresAt: account.expiresAt,
        });
      }
      return Promise.resolve({ ok: false as const, error: `Unsupported provider: ${account.provider}` });
    })
  );

  return NextResponse.json({
    attempted: results.length,
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  });
}
