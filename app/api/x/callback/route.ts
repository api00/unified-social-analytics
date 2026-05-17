import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { connectedAccounts } from "../../../../db/schema";
import { verifyOAuthState } from "../../../../lib/oauth-state";
import { exchangeCodeForTokens, getXRedirectUri } from "../../../../lib/x/oauth";
import { syncXAccount, fetchXMe } from "../../../../lib/x/sync";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const stateParam = requestUrl.searchParams.get("state");
  const state = verifyOAuthState(stateParam);
  const redirectTo = new URL("/?connected=x", requestUrl.origin);

  if (!code || !state || !state.codeVerifier) {
    redirectTo.searchParams.set("error", "x_oauth_failed");
    return NextResponse.redirect(redirectTo);
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: state.codeVerifier,
      redirectUri: getXRedirectUri(requestUrl.origin),
    });

    const me = await fetchXMe(tokens.access_token);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const accountValues = {
      userId: state.userId,
      provider: "x" as const,
      providerAccountId: me.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      scopes: tokens.scope ?? null,
      rawProfile: me as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select({ id: connectedAccounts.id, refreshToken: connectedAccounts.refreshToken })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, state.userId),
          eq(connectedAccounts.provider, "x"),
          eq(connectedAccounts.providerAccountId, me.id)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(connectedAccounts)
        .set({
          ...accountValues,
          refreshToken: accountValues.refreshToken ?? existing.refreshToken,
        })
        .where(eq(connectedAccounts.id, existing.id));
    } else {
      await db.insert(connectedAccounts).values(accountValues);
    }

    const [account] = await db
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
      .where(
        and(
          eq(connectedAccounts.userId, state.userId),
          eq(connectedAccounts.provider, "x"),
          eq(connectedAccounts.providerAccountId, me.id)
        )
      )
      .limit(1);

    if (!account) throw new Error("Could not store X account.");

    await syncXAccount({
      id: account.id,
      userId: account.userId,
      provider: "x",
      providerAccountId: account.providerAccountId,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      expiresAt: account.expiresAt,
    });

    redirectTo.searchParams.set("status", "connected");
  } catch (error) {
    redirectTo.searchParams.set("error", error instanceof Error ? error.message : "x_callback_failed");
  }

  return NextResponse.redirect(redirectTo);
}
