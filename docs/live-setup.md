# Live Setup

## Local

1. Copy `.env.example` to `.env.local`.
2. Paste the Postgres connection string into `DATABASE_URL`.
3. Add `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:3000`.
4. Run `npm run db:generate`, then `npm run db:migrate`.
5. In Google Cloud Console, create an OAuth client and enable YouTube Data API v3 + YouTube Analytics API.
6. Add authorized redirect URIs for Better Auth:
   - `http://localhost:3000/api/auth/callback/google`
   - the Vercel preview `/api/auth/callback/google`
   - `https://www.mimicx.live/api/auth/callback/google`
7. Add authorized redirect URIs for YouTube channel connection:
   - `http://localhost:3000/api/youtube/callback`
   - the Vercel preview `/api/youtube/callback`
   - `https://www.mimicx.live/api/youtube/callback`
8. Add `OPENAI_API_KEY`.
9. Run `npm run dev`.

## Vercel Staging

1. Import this repo into Vercel.
2. Add every env var from `.env.example`.
3. Set `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL`, and `GOOGLE_YOUTUBE_REDIRECT_URL` to the staging URL first.
4. Deploy and verify:
   - unauthenticated `/` shows the auth modal
   - Google login returns to `/`
   - YouTube connect redirects and stores a channel
   - Sync writes analytics rows
   - Chat creates persisted threads and uses synced data

## Production Domain

Only attach the domain after staging passes.

1. In Vercel, add:
   - `mimicx.live`
   - `www.mimicx.live`
2. Update DNS at the domain registrar using Vercel’s records.
3. Update env values:
   - `NEXT_PUBLIC_SITE_URL=https://www.mimicx.live`
   - `BETTER_AUTH_URL=https://www.mimicx.live`
   - `GOOGLE_YOUTUBE_REDIRECT_URL=https://www.mimicx.live/api/youtube/callback`
4. Add production callback URLs in Google Cloud.
5. Redeploy production.

## Notes

- Google signup and YouTube analytics are v1.
- TikTok and Instagram stay visually represented but are not connected until later API work.
- OAuth tokens are stored server-side in `connected_accounts` and are never queried from the browser.
- Cron sync runs every 6 hours through `vercel.json` and must send `CRON_SECRET`.
- Drizzle schema lives in `db/schema.ts`; use `npm run db:generate` and `npm run db:migrate` when the schema changes.
