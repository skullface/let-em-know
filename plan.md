---
name: let-em-know (Next Cavs game)
overview: A Next.js web app + JSON API that shows the Cleveland Cavaliers’ next upcoming game with broadcasts, standings, injury report (PDF), recent games, and head-to-head history. Data is aggregated from NBA free endpoints and cached in Upstash Redis, with a Vercel cron job pre-warming caches.
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
  - id: projected-lineups
    content: "Implement projected starting five (currently returned as empty arrays) and add a UI section if desired"
    status: pending
isProject: false
---

# let-em-know — Next Cavs game

## What exists today (matches current code)

This repository currently contains **only the Next.js web app + API** (no macOS/iOS projects in this repo).

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
  projectedLineups: { cavaliers: Player[]; opponent: Player[] }; // currently empty arrays
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

- **Projected lineups**: `projectedLineups` is currently returned as empty arrays. The codebase already has roster fetch + cache keys reserved (`CacheKeys.lineups`, `CacheKeys.recentStarters`), but no implemented derivation yet.
- **Cron/auth documentation**: deployment should document required env vars and cron auth expectations (`CRON_SECRET`, `CACHE_CLEAR_SECRET`, Upstash vars).

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

## Architecture Overview

Three client apps share a single **Next.js API backend** that fetches, caches, and serves aggregated game data. The backend runs as a Next.js app deployed to Vercel (or similar), serving both the web UI and a REST/JSON API consumed by the native clients.

```mermaid
graph TD
  subgraph clients [Client Apps]
    WebApp[Next.js Web App]
    MenuBar[macOS Menubar App - Swift]
    iOS[iOS Widget - WidgetKit]
  end

  subgraph backend [Next.js API Backend]
    API[API Routes]
    Cache[In-Memory / KV Cache]
    Cron[Cron Jobs]
  end

  subgraph sources [Data Sources - Free, No Auth]
    Schedule[NBA Schedule CDN]
    Scoreboard[NBA Scoreboard CDN]
    Standings[NBA Stats - Standings]
    BoxScore[NBA Stats - BoxScore]
    GameLog[NBA Stats - TeamGameLog]
    InjuryPDF[NBA Injury Report PDF]
  end

  WebApp --> API
  MenuBar --> API
  iOS --> API
  API --> Cache
  Cron --> Cache
  Cron --> Schedule
  Cron --> Scoreboard
  Cron --> Standings
  Cron --> BoxScore
  Cron --> GameLog
  Cron --> InjuryPDF
```

## Data Sources (All Free, No API Key Required)

| Data Need                                         | Source           | Endpoint                                                                  |
| ------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| Schedule, date/time, opponent, arena, broadcasts  | NBA CDN          | `cdn.nba.com/static/json/staticData/scheduleLeagueV2.json`                |
| Today's scoreboard (live game status)             | NBA CDN          | `cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`    |
| Conference/league standings                       | NBA Stats        | `stats.nba.com/stats/leaguestandingsv3`                                   |
| Box scores (opponent last 3 games + H2H matchups) | NBA Stats        | `stats.nba.com/stats/boxscoretraditionalv3`                               |
| Team game log (find recent games)                 | NBA Stats        | `stats.nba.com/stats/teamgamelog`                                         |
| Injury reports                                    | NBA Official PDF | `ak-static.cms.nba.com/referee/injury/Injury-Report_YYYY-MM-DD_...pdf`    |
| Starting lineups (game-day)                       | NBA Stats        | `stats.nba.com/stats/boxscoretraditionalv3` (once tip-off data available) |

**Note on stats.nba.com**: These endpoints require a `Referer: https://www.nba.com` header and a browser-like `User-Agent`, but no API key. The `nba_api` Python patterns document the exact headers needed; we will replicate them in our Node.js fetch calls.

**Note on injury reports**: The NBA publishes injury reports as PDFs. We will parse these using a PDF-to-text library. The report URL pattern is predictable by date.

**Note on starting lineups**: True "starting lineups" are confirmed only at tip-off. Pre-game, we show the projected/expected starters from the injury report status (players listed as "Available" or "Probable") combined with recent starting lineup data from box scores.

## Caching and Refresh Strategy

Since games are never less than 24 hours apart, we use a tiered cron strategy:

- **Schedule + Standings**: Refresh every **6 hours**. Changes are rare and slow-moving.
- **Opponent last 3 games + H2H matchups**: Refresh every **6 hours** (or when the "next game" changes). These are historical and only change after new games are played.
- **Injury report**:
  - Non-game-day: Refresh every **6 hours**.
  - Game-day (detected automatically): Refresh every **30 minutes** from 10am ET to tip-off (NBA mandates updates by 1pm ET game-day).
- **Scoreboard/live data**: Only fetched on game-day, every **2 minutes** during game window.
- **Starting lineups**: Fetched once ~15 min before tip-off and again shortly after tip-off from box score data.

All data is cached in **Vercel KV** (or Redis) so API responses to clients are instant. The cron jobs are the only processes hitting NBA endpoints.

**Cost estimate**: ~50-100 NBA API calls per game day, ~20 calls on non-game days. Well within any rate limits for these free endpoints.

## App 1: Next.js Web App (Build First)

This is the foundation -- it contains both the backend API and the web frontend.

**Tech stack**:

- **Next.js 15** (App Router) with TypeScript
- **Tailwind CSS** for styling
- **Vercel KV** (or Upstash Redis) for caching
- **Vercel Cron** for scheduled data fetching
- Deployed to **Vercel** free tier

**Pages**:

- Single-page app showing the next Cavaliers game with all required data sections
- Dark theme with Cavaliers branding (wine #6F263D and gold #FFB81C)

**API routes** (consumed by all clients):

- `GET /api/next-game` -- returns the complete aggregated "next game" payload:

```typescript
interface NextGameResponse {
  game: {
    gameId: string;
    dateTime: string; // ISO 8601
    opponent: TeamInfo;
    location: string;
    isHome: boolean;
    broadcasts: Broadcast[];
  };
  standings: {
    cavaliers: StandingsEntry;
    opponent: StandingsEntry;
  };
  injuries: {
    cavaliers: InjuryEntry[];
    opponent: InjuryEntry[];
  };
  projectedLineups: {
    cavaliers: Player[];
    opponent: Player[];
  };
  opponentRecentGames: GameSummary[]; // last 3
  headToHead: GameSummary[]; // last 3 matchups
  lastUpdated: string;
}
```

**Key source files**:

- `src/lib/nba/schedule.ts` -- parse schedule JSON, find next CLE game
- `src/lib/nba/standings.ts` -- fetch and parse standings
- `src/lib/nba/injuries.ts` -- fetch and parse injury report PDFs
- `src/lib/nba/gamelog.ts` -- fetch team game logs, box scores
- `src/lib/nba/lineups.ts` -- derive projected lineups from box scores + injuries
- `src/lib/cache.ts` -- KV cache read/write helpers
- `src/app/api/next-game/route.ts` -- the unified API endpoint
- `src/app/api/cron/refresh/route.ts` -- cron handler for data refresh
- `src/app/page.tsx` -- the main web UI

## App 2: macOS Menubar App (Swift)

A lightweight native macOS app that sits in the menu bar showing the next game countdown and details in a popover.

**Tech stack**:

- **Swift + SwiftUI** with `MenuBarExtra` (macOS 13+)
- Fetches from the deployed Next.js `/api/next-game` endpoint
- Polls every 30 min (or 5 min on game day)

**Features**:

- Menu bar icon shows Cavaliers logo + countdown ("3h 22m") or "LIVE"
- Click to expand a popover with full game details
- Native macOS notifications for game-day reminders

## App 3: iOS App + Widget (Swift)

A minimal iOS app with a WidgetKit home screen widget.

**Tech stack**:

- **Swift + SwiftUI** for the app
- **WidgetKit** for home screen widgets (small, medium, large)
- Shared Swift Package for models and API client (reused with menubar app)

**Features**:

- Small widget: opponent logo, date/time, location
- Medium widget: adds broadcast info, standings snippet
- Large widget: full detail including injuries
- App provides full detail view similar to web app

**Code sharing** (macOS + iOS): A local Swift Package (`NextBallKit`) containing:

- API client (`NextBallAPI.swift`)
- Shared models (`Models.swift`)
- Date/formatting utilities

## Recommended Build Order

1. **Next.js Web App** -- build the backend API + web UI first. This validates all data sources, caching logic, and provides the API that native apps will consume.
2. **macOS Menubar App** -- quick to build once the API exists; good for daily use during development.
3. **iOS App + Widget** -- most complex native client; build last with the shared Swift package.

## Project Structure

```
next-ball/
  web/                          # Next.js app (web + API backend)
    src/
      app/
        api/
          next-game/route.ts
          cron/refresh/route.ts
        page.tsx
        layout.tsx
      lib/
        nba/
          schedule.ts
          standings.ts
          injuries.ts
          gamelog.ts
          lineups.ts
          types.ts
        cache.ts
      components/
        GameCard.tsx
        StandingsTable.tsx
        InjuryReport.tsx
        Starters.tsx, StartingLineupSection.tsx
        BroadcastInfo.tsx
        RecentGames.tsx
    tailwind.config.ts
    package.json
  apple/                        # Xcode workspace
    NextBallKit/                # Shared Swift Package
      Sources/NextBallKit/
        API.swift
        Models.swift
    NextBallMac/                # macOS menubar app target
    NextBalliOS/                # iOS app target
    NextBallWidget/             # WidgetKit extension
```
