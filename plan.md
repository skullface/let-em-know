---
name: let-em-know (Next Cavs game)
overview: A multi-platform “next Cavs game” experience. The Next.js web app is the source of truth and exposes a JSON API (`/api/next-game`) that powers the web UI and planned native clients (macOS menubar + iOS app/widget). Data is aggregated from free NBA endpoints, cached in Upstash Redis, and pre-warmed via Vercel cron.
todos:
  - id: web-backend
    content: "Next.js backend implemented: NBA fetchers (schedule, standings, injuries PDF parsing, game logs/H2H, box score top performers), Redis cache layer, cron refresh logic, and /api/next-game endpoint"
    status: completed
  - id: web-frontend
    content: "Next.js web UI implemented: game card + broadcasts, standings, injuries, recent games, head-to-head (with top performers for last matchup)"
    status: completed
  - id: deploy-web
    content: "Deploy to Vercel with Upstash Redis + cron configured and documented env vars"
    status: in_progress
  - id: swift-package
    content: "Create a shared Swift package (models + API client) for macOS/iOS using the deployed `/api/next-game`"
    status: pending
  - id: mac-menubar
    content: "Build macOS menubar app (SwiftUI `MenuBarExtra`) that consumes `/api/next-game`"
    status: pending
  - id: ios-widget
    content: "Build iOS app + WidgetKit widgets that consume `/api/next-game`"
    status: pending
isProject: false
---

# let-em-know — Next Cavs game

## What exists today (matches current code)

This repository currently contains the **Next.js web app + API**. The macOS/iOS clients are still part of the overall plan, but are not implemented in this repo yet.

- **Next.js**: App Router on Next.js 16 (`next` dependency) with React 19 + TypeScript.
- **Styling**: Tailwind CSS v4 (`src/app/globals.css` defines theme tokens; Cavaliers wine/gold).
- **Homepage**: `src/app/page.tsx` calls the shared data layer directly (`getNextGameData`) and renders:
  - Game card + broadcast info
  - Standings
  - Injury report (from NBA official PDF)
  - Last three games (Cavs + opponent)
  - Head-to-head this season + top performers for the most recent matchup
- **API routes**:
  - `GET /api/next-game`: returns the aggregated payload as JSON.
  - `GET /api/cron/refresh`: clears/warm-caches schedule/standings/next-game every 6 hours (see `vercel.json`).
    - Auth: either Vercel cron UA (`vercel-cron/1.0`) **or** `Authorization: Bearer $CRON_SECRET`.
  - `GET /api/cache/clear`: manual cache bust (requires `?secret=$CACHE_CLEAR_SECRET`; optional `&all=1`).

## Architecture overview (current)

```mermaid
graph TD
  User[Browser] --> Web[Next.js App Router]
  Web --> Data[getNextGameData()]
  Web --> API[/api/next-game]
  Cron[Vercel Cron] --> Refresh[/api/cron/refresh]

  Data --> Cache[Upstash Redis]
  API --> Cache
  Refresh --> Cache

  Data --> CDN[cdn.nba.com schedule + boxscore]
  Data --> Stats[stats.nba.com standings + gamelog + leaguegamefinder + roster]
  Data --> Inj[official.nba.com injury page + ak-static PDF]

  NativeMac[macOS menubar app (planned)] --> API
  NativeiOS[iOS app/widget (planned)] --> API
```

## Data sources (as implemented)

- **Schedule + opponent + broadcasts**: `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json`
- **Standings**: `https://stats.nba.com/stats/leaguestandingsv3` (with NBA-required headers)
- **Injury report**:
  - Scrapes `https://official.nba.com/nba-injury-report-2025-26-season/` for the latest PDF for the date
  - Fetches PDF from `https://ak-static.cms.nba.com/referee/injury/…`
  - Parses via `pdf-parse` with a Node polyfill for `DOMMatrix` (`dommatrix`)
- **Recent games**:
  - Prefer schedule-derived finals where possible, otherwise fallback to `https://stats.nba.com/stats/teamgamelog`
- **Head-to-head this season**:
  - Prefer schedule-derived finals, otherwise fallback to `https://stats.nba.com/stats/leaguegamefinder`
- **Top performers (most recent H2H)**:
  - Prefer CDN boxscore: `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_<GAME_ID>.json`
  - Fallback to `https://stats.nba.com/stats/boxscoretraditionalv3`
- **Roster (used to enrich injuries with jersey numbers)**:
  - `https://stats.nba.com/stats/commonteamroster`

## Caching and refresh strategy (as implemented)

Caching is handled by **Upstash Redis** via `@upstash/redis`:

- **Env vars**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Build behavior**: during `next build`, Redis is intentionally skipped (`src/lib/cache.ts`) to avoid forcing dynamic rendering.
- **Homepage behavior**: the page is `dynamic = "force-dynamic"` and `revalidate = 300`.

Current TTLs live in `src/lib/cache.ts` (`CACHE_TTL`), including:

- Schedule/standings: 6 hours
- Injuries:
  - Non-game-day: 6 hours
  - Game-day: 30 minutes before 1pm ET, 10 minutes after 1pm ET
- Recent games / head-to-head / roster: 6 hours

Vercel cron config is checked into `vercel.json` and calls `/api/cron/refresh` at `0 0,6,12,18 * * *` to clear and warm caches (including the combined “next game” payload).

## API response shape (current)

`GET /api/next-game` returns `NextGameResponse` (`src/lib/nba/types.ts`):

```typescript
export interface NextGameResponse {
  game: {
    gameId: string;
    dateTime: string; // ISO 8601
    opponent: TeamInfo;
    location: string;
    isHome: boolean;
    broadcasts: Broadcast[];
  };
  standings: { cavaliers: StandingsEntry; opponent: StandingsEntry };
  injuries: { cavaliers: InjuryEntry[]; opponent: InjuryEntry[] };
  projectedLineups: { cavaliers: Player[]; opponent: Player[] }; // reserved; feature removed (empty arrays)
  cavaliersRecentGames: GameSummary[]; // last 3
  opponentRecentGames: GameSummary[]; // last 3
  headToHead: GameSummary[]; // 0–4 (this season)
  lastHeadToHeadBoxScore: LastH2HBoxScore | null; // top performers for most recent H2H
  lastUpdated: string;
}
```

## Key source files (current)

- **Aggregation**: `src/lib/next-game.ts`
- **Cache**: `src/lib/cache.ts`
- **NBA modules**:
  - `src/lib/nba/schedule.ts`
  - `src/lib/nba/standings.ts`
  - `src/lib/nba/injuries.ts`
  - `src/lib/nba/gamelog.ts`
  - `src/lib/nba/types.ts`
- **API routes**:
  - `src/app/api/next-game/route.ts`
  - `src/app/api/cron/refresh/route.ts`
  - `src/app/api/cache/clear/route.ts`
- **UI**:
  - `src/app/page.tsx`
  - `src/components/*`

## Known gaps / next steps

- **Cron/auth documentation**: deployment should document required env vars and cron auth expectations (`CRON_SECRET`, `CACHE_CLEAR_SECRET`, Upstash vars).

## Roadmap: macOS menubar app + iOS app/widget (planned)

These native clients are **thin clients** backed by the deployed web app’s `/api/next-game` response.

### Shared Swift package (planned)

- **Purpose**: share the API client, models, and date/formatting helpers between macOS and iOS.
- **Inputs**: a configurable base URL pointing at the deployed web app (e.g. `https://<app>/api/next-game`).
- **Behavior**: fetch + decode `NextGameResponse` and expose UI-friendly view models.

### macOS menubar app (planned)

- **Tech**: SwiftUI + `MenuBarExtra` (macOS 13+).
- **UI**: menu bar item shows countdown (or “LIVE”), popover shows key sections from the API.
- **Refresh**: poll the API on an interval (e.g. 30 minutes; faster on game day if desired).

### iOS app + WidgetKit (planned)

- **Tech**: SwiftUI app + WidgetKit widgets.
- **Widgets**:
  - Small: opponent + date/time/location
  - Medium: add broadcasts + standings snippet
  - Large: add injuries + head-to-head highlight
- **Refresh**: via widget timeline policies backed by `/api/next-game`.

## Deployment notes (current)

- **Required env vars**:
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - `CRON_SECRET` (optional if relying solely on Vercel cron UA, but recommended)
  - `CACHE_CLEAR_SECRET` (for manual cache clearing endpoint)
- **Optional**:
  - `NEXT_PUBLIC_FATHOM_ID` (analytics; see `src/app/fathom.tsx`)

## Local development

```bash
npm install
npm run dev
```
