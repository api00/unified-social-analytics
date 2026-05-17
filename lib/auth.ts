import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "../db";
import * as schema from "../db/schema";
import { getSiteUrl } from "./env";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const authSecret = process.env.BETTER_AUTH_SECRET || "unified-social-analytics-local-build-secret";
const canUseGoogleAuth = Boolean(
  process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    googleClientId &&
    googleClientSecret
);

export const auth = betterAuth({
  appName: "Unified Social Analytics",
  baseURL: process.env.BETTER_AUTH_URL || getSiteUrl(),
  secret: authSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  socialProviders:
    canUseGoogleAuth && googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
  trustedOrigins: [
    getSiteUrl(),
    "http://localhost:3000",
    "http://localhost:3001",
    "https://mimicx.live",
    "https://www.mimicx.live",
    "https://*.vercel.app",
  ],
  plugins: [nextCookies()],
});
