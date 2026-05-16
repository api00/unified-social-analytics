import crypto from "node:crypto";

export type OAuthStatePayload = {
  userId: string;
  nonce: string;
  issuedAt: number;
};

function getStateSecret() {
  return process.env.YOUTUBE_OAUTH_STATE_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signOAuthState(payload: OAuthStatePayload) {
  const secret = getStateSecret();
  if (!secret) return null;

  const body = encode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyOAuthState(state: string | null): OAuthStatePayload | null {
  const secret = getStateSecret();
  if (!state || !secret) return null;

  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const payload = JSON.parse(decode(body)) as OAuthStatePayload;
  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - payload.issuedAt > maxAgeMs) return null;

  return payload;
}
