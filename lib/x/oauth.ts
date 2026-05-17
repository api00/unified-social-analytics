import crypto from "node:crypto";
import { getSiteUrl } from "../env";

export const X_SCOPES = ["tweet.read", "users.read", "offline.access"];

const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export type XTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export function getXRedirectUri(origin?: string) {
  return process.env.X_OAUTH_REDIRECT_URL ?? `${origin ?? getSiteUrl()}/api/x/callback`;
}

export function createPkcePair() {
  const codeVerifier = crypto.randomBytes(64).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl({
  state,
  codeChallenge,
  redirectUri,
}: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}) {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) return null;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

function basicAuthHeader() {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function exchangeCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<XTokens> {
  const auth = basicAuthHeader();
  if (!auth) throw new Error("X OAuth credentials are not configured.");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as XTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<XTokens> {
  const auth = basicAuthHeader();
  if (!auth) throw new Error("X OAuth credentials are not configured.");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X token refresh failed: ${response.status} ${text}`);
  }

  return (await response.json()) as XTokens;
}
