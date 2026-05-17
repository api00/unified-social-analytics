# Unified Social Analytics — Project Map

Creator-analytics dashboard. Connects YouTube (live), shows demo data for TikTok/Instagram, and provides a data-aware growth-advisor chat. Single Next.js App Router app, Better Auth + Drizzle/Postgres, Vercel cron for periodic sync.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript strict
- Tailwind v4 (`@tailwindcss/postcss`) **plus** hand-rolled CSS in `styles/*.css` — both are in use
- **Better Auth** (`better-auth` + `@better-auth/drizzle-adapter`) with Google social provider — wired in `lib/auth.ts`
- **Drizzle ORM + raw `postgres` driver** for Postgres. `db/schema.ts` is the source of truth; migrations live in `drizzle/`.
- `googleapis` for YouTube Data API v3 + YouTube Analytics v2
- `openai` for the growth-advisor chat (Responses API, default model `gpt-4.1-mini`)
- `recharts`, `framer-motion`, `lucide-react`, `simple-icons`, `zod`
- **No Supabase.** An earlier version used Supabase auth + Supabase Postgres; that was migrated out in commit `9b0bec5`. Don't reference `lib/supabase/*` or `auth.users` — they don't exist anymore.

## Top-level Layout

```
app/                  Next.js App Router
  layout.tsx          Root: fonts + metadata
  page.tsx            Server component: getCurrentUser() → renders <DashboardShell />
  globals.css         Imports tokens.css, shell.css, components.css, etc.
  api/
    auth/[...all]/        Better Auth handler — exposes /api/auth/sign-in, /api/auth/sign-out, /api/auth/callback/google, etc.
    analytics/overview/   GET → live overview from synced data; falls back to demoOverview
    channels/             GET → user's youtube_channels rows; demo fallback
    chat/                 POST → persist message + OpenAI response (or fallback advice)
    chat/threads/         GET → list user's chat threads + messages
    youtube/connect/      GET → returns Google OAuth URL with signed state (separate from sign-in flow)
    youtube/callback/     GET → exchanges code, upserts connected_account + channel, runs first sync
    youtube/sync/         POST → on-demand sync for current user
    cron/sync-youtube/    GET → cron-triggered sync of ALL accounts; auth via CRON_SECRET

components/           All client components
  DashboardShell.tsx  Main shell: sidebar nav, section switcher; calls authClient.signOut()
  AuthModal.tsx       Google sign-in modal — uses authClient.signIn.social({ provider: "google" })
  ChannelManager.tsx  Channel list + add-channel dialog; triggers /api/youtube/connect
  GrowthAdvisor.tsx   Chat UI; posts to /api/chat
  GrowthCharts.tsx, TopContentChart.tsx, PlatformBreakdown.tsx, MetricCard.tsx, BrandLogo.tsx, SocialLogo.tsx

lib/
  auth.ts             betterAuth({ database: drizzleAdapter(db, { provider: "pg", schema }), socialProviders: { google }, plugins: [nextCookies()] })
  auth-client.ts      createAuthClient() for browser
  current-user.ts     getCurrentUser() → calls auth.api.getSession({ headers }); returns null if no DATABASE_URL
  env.ts              hasDatabaseEnv / hasAuthEnv / hasGoogleYouTubeEnv / hasOpenAIEnv, getSiteUrl()
  oauth-state.ts      HMAC-signed state for YouTube OAuth (10-min TTL) — used ONLY by the separate /api/youtube/* flow
  youtube/
    oauth.ts          YOUTUBE_SCOPES, createYouTubeOAuthClient, getYouTubeRedirectUri
    sync.ts           syncYouTubeAccount — channels.list + analytics reports (daily + top videos), upserts into youtube_channels/analytics_daily/content_items, logs sync_runs. Uses raw Drizzle `db` client.
  analytics/
    overview.ts       getOverviewForUser(db, userId) + summarizeOverviewForPrompt(overview)

db/
  schema.ts           Drizzle: user, session, account, verification (Better Auth tables) + connected_accounts, youtube_channels, analytics_daily, content_items, sync_runs, chat_threads, chat_messages
  index.ts            Postgres client (`postgres` driver) + drizzle instance (uses DATABASE_URL)

drizzle/              Generated migrations (drizzle-kit)
  0000_sparkling_lifeguard.sql

data/                 Demo/seed data — fallback when user is not signed in or has no live data
  analytics.ts        demoOverview, networkMetrics, weeklySeries, topContent, formatCompactNumber
  channels.ts, chat.ts, socials.ts

types/analytics.ts    Shared types: PlatformId, OverviewData, ChannelAccount, ChatMessage, ChatThread, etc.

styles/               Hand-rolled CSS (most styling lives here)
  tokens.css, shell.css, components.css, channels.css, charts.css, chat.css, responsive.css, utilities.css

docs/live-setup.md    Env + database + Google Cloud + Vercel setup walkthrough
drizzle.config.ts     Drizzle Kit config — out: ./drizzle, dialect: postgresql, uses DATABASE_URL
proxy.ts              Stale: exports `proxy` (not `middleware`) wrapping a now-deleted Supabase middleware. Currently dead code; safe to delete.
vercel.json           Cron: /api/cron/sync-youtube every 6 hours
```

## Auth Flow (Better Auth)

1. `AuthModal` calls `authClient.signIn.social({ provider: "google", callbackURL: "/", scopes: ["openid","email","profile"] })`.
2. Better Auth redirects to Google.
3. Google returns to `/api/auth/callback/google` (handled by the `[...all]` catch-all route → `toNextJsHandler(auth.handler)`).
4. Better Auth creates/updates `user` + `session` + `account` rows and sets a session cookie via `nextCookies()` plugin.
5. `app/page.tsx` calls `getCurrentUser()` → `auth.api.getSession({ headers })` reads the cookie and returns the user.

**YouTube channel connection is a separate OAuth flow** (`/api/youtube/connect` → `/api/youtube/callback`) — it's NOT the same as Better Auth's Google sign-in. It uses its own HMAC-signed state and stores tokens in `connected_accounts`. One Google OAuth client in Cloud Console can power both, as long as both redirect URIs are authorized.

## Demo → Live Fallback Pattern

Every data API route falls back to demo data when DB is missing or the user has no synced data:
- `/api/analytics/overview` → returns `demoOverview` if no live rows
- `/api/channels` → returns `channelAccounts` if no live rows
- `/api/chat/threads` → returns demo threads
- `/api/chat` (POST) → uses `fallbackAdvice()` if no OpenAI key

Client components seed state from demo data on first render, then `useEffect` swaps in live data if the fetch succeeds. So the dashboard is always usable, even with zero env config.

## Env Vars

Public (browser):
- `NEXT_PUBLIC_SITE_URL`

Server:
- `DATABASE_URL` — Postgres connection string (required for everything)
- `BETTER_AUTH_SECRET` — long random string (session signing)
- `BETTER_AUTH_URL` — defaults to `getSiteUrl()`; set explicitly in prod
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — used by Better Auth AND `/api/youtube/connect`
- `GOOGLE_YOUTUBE_REDIRECT_URL` — for the YouTube channel-connect OAuth flow only
- `YOUTUBE_OAUTH_STATE_SECRET` — HMAC for YouTube OAuth state (falls back to CRON_SECRET)
- `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4.1-mini`)
- `CRON_SECRET` — required by `/api/cron/sync-youtube`

Gate functions in `lib/env.ts`:
- `hasDatabaseEnv()` = `DATABASE_URL`
- `hasAuthEnv()` = `DATABASE_URL` + `BETTER_AUTH_SECRET` + `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- `hasGoogleYouTubeEnv()` = `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + (`GOOGLE_YOUTUBE_REDIRECT_URL` or `NEXT_PUBLIC_SITE_URL`)
- `hasOpenAIEnv()` = `OPENAI_API_KEY`

## Scripts

- `npm run dev` / `build` / `start`
- `npm run db:generate` — generate a new migration from `db/schema.ts`
- `npm run db:migrate` — apply migrations in `drizzle/`
- `npm run db:push` — push schema directly without migration (dev only)
- `npm run db:studio` — open Drizzle Studio

No test, lint, or typecheck scripts in `package.json` yet.

## Conventions

- Relative imports (`../data/analytics`) over `@/*` alias.
- Most styling is hand-rolled CSS in `styles/`. `AuthModal.tsx` is the one component using Tailwind utility classes directly.
- DB writes use `upsert` with explicit `onConflict` for idempotency across re-syncs.

## Known Gaps / Next Work

- TikTok + Instagram are visual-only — no API integration yet.
- `proxy.ts` is dead code from the old Supabase middleware; safe to delete.
- No tests. No CI. No `.claude/` project-local harness config.
- Old `docs/live-setup.md` step 4 references `npm run db:generate` before `db:migrate` — only needed if you change `db/schema.ts`; otherwise the existing migration in `drizzle/` is enough.
