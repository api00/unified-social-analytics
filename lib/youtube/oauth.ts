import { google } from "googleapis";
import { getSiteUrl } from "../env";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export function getYouTubeRedirectUri(origin?: string) {
  return process.env.GOOGLE_YOUTUBE_REDIRECT_URL ?? `${origin ?? getSiteUrl()}/api/youtube/callback`;
}

export function createYouTubeOAuthClient(redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
