# Next Ball - Cleveland Cavaliers Game App

A multi-platform app showing the next upcoming game for the Cleveland Cavaliers, including game details, broadcasts, injury reports, lineups, standings, and recent game history.

## Features

- **Next Game Information**: Date, time, opponent, location
- **Broadcast Information**: TV channels and streaming apps
- **Injury Reports**: Game-day injury status for both teams
- **Starting Lineups**: Projected and confirmed lineups
- **Standings**: Conference and league standings for both teams
- **Recent Games**: Opponent's last 3 games and head-to-head history

## Tech Stack

- **Next.js 16** (App Router) with TypeScript
- **Tailwind CSS** for styling
- **Upstash Redis** for caching
- **NBA CDN & Stats APIs** for data (all free, no API keys required)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Upstash Redis credentials:
- Sign up at [Upstash](https://upstash.com/) and create a Redis database
- Copy the REST URL and token to your `.env` file

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Data Sources

All data is fetched from free NBA endpoints:
- Schedule: `cdn.nba.com/static/json/staticData/scheduleLeagueV2.json`
- Standings: `stats.nba.com/stats/leaguestandingsv3`
- Box Scores: `stats.nba.com/stats/boxscoretraditionalv3`
- Game Logs: `stats.nba.com/stats/teamgamelog`
- Injury Reports: `ak-static.cms.nba.com/referee/injury/` (PDF parsing)

## Caching Strategy

- Schedule & Standings: Refreshed every 6 hours
- Injury Reports: Every 6 hours (non-game day) or 30 minutes (game day)
- Opponent Games & H2H: Every 6 hours
- All data cached in Upstash Redis for fast API responses

## Deployment

The app can be deployed to Vercel:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Set up Vercel Cron jobs (or use external cron) to call `/api/cron/refresh`

## Future Platforms

- **macOS Menubar App**: Native Swift app consuming the API
- **iOS Widget**: WidgetKit home screen widget

## License

ISC
