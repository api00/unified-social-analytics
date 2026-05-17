import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { signOAuthState } from "../../../../lib/oauth-state";
import { createYouTubeOAuthClient, getYouTubeRedirectUri, YOUTUBE_SCOPES } from "../../../../lib/youtube/oauth";
import { getCurrentUser } from "../../../../lib/current-user";
import { hasGoogleYouTubeEnv } from "../../../../lib/env";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before connecting YouTube." }, { status: 401 });
  if (!hasGoogleYouTubeEnv()) {
    return NextResponse.json({ error: "Google YouTube OAuth env values are not configured." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = getYouTubeRedirectUri(origin);
  const oauth = createYouTubeOAuthClient(redirectUri);
  const state = signOAuthState({
    userId: user.id,
    nonce: randomUUID(),
    issuedAt: Date.now(),
  });

  if (!oauth || !state) {
    return NextResponse.json({ error: "YouTube OAuth state could not be created." }, { status: 503 });
  }

  const url = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: YOUTUBE_SCOPES,
    state,
  });

  return NextResponse.json({ url });
}
