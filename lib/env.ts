export type PublicEnv = {
  siteUrl: string;
};

export function getPublicEnv(): PublicEnv {
  return {
    siteUrl: getSiteUrl(),
  };
}

export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function hasDatabaseEnv() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasAuthEnv() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.BETTER_AUTH_SECRET &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
  );
}

export function hasGoogleYouTubeEnv() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_YOUTUBE_REDIRECT_URL || process.env.NEXT_PUBLIC_SITE_URL)
  );
}

export function hasOpenAIEnv() {
  return Boolean(process.env.OPENAI_API_KEY);
}
