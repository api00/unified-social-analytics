# Live Setup

## Local

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project and paste the URL, anon key, and service role key.
3. Run the SQL in `supabase/migrations/20260517000000_initial_schema.sql` in Supabase SQL editor.
4. In Supabase Auth, enable Google and add:
   - `http://localhost:3000/auth/callback`
   - the Vercel preview callback URL
   - `https://www.mimicx.live/auth/callback`
5. In Google Cloud Console, create an OAuth client and add YouTube Data API v3 + YouTube Analytics API.
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/youtube/callback`
   - the Vercel preview `/api/youtube/callback`
   - `https://www.mimicx.live/api/youtube/callback`
7. Add `OPENAI_API_KEY`.
8. Run `npm run dev`.

## Vercel Staging

1. Import this repo into Vercel.
2. Add every env var from `.env.example`.
3. Set `NEXT_PUBLIC_SITE_URL` and `GOOGLE_YOUTUBE_REDIRECT_URL` to the staging URL first.
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
   - `GOOGLE_YOUTUBE_REDIRECT_URL=https://www.mimicx.live/api/youtube/callback`
4. Add production callback URLs in Supabase and Google Cloud.
5. Redeploy production.

## Notes

- Google signup and YouTube analytics are v1.
- TikTok and Instagram stay visually represented but are not connected until later API work.
- OAuth tokens are stored server-side in `connected_accounts` and are never queried from the browser.
- Cron sync runs every 6 hours through `vercel.json` and must send `CRON_SECRET`.
