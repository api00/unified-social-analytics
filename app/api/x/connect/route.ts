import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { hasXEnv } from "../../../../lib/env";
import { getCurrentUser } from "../../../../lib/current-user";
import { signOAuthState } from "../../../../lib/oauth-state";
import { buildAuthorizeUrl, createPkcePair, getXRedirectUri } from "../../../../lib/x/oauth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before connecting X." }, { status: 401 });
  if (!hasXEnv()) {
    return NextResponse.json({ error: "X OAuth credentials are not configured." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = getXRedirectUri(origin);
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = signOAuthState({
    userId: user.id,
    nonce: randomUUID(),
    issuedAt: Date.now(),
    codeVerifier,
  });

  if (!state) {
    return NextResponse.json({ error: "Could not sign OAuth state." }, { status: 503 });
  }

  const url = buildAuthorizeUrl({ state, codeChallenge, redirectUri });
  if (!url) {
    return NextResponse.json({ error: "Could not build X authorization URL." }, { status: 503 });
  }

  return NextResponse.json({ url });
}
