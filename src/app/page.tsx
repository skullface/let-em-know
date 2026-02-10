import { NextGameResponse } from "@/lib/nba/types";
import GameCard from "@/components/GameCard";
import StandingsTable from "@/components/StandingsTable";
import InjuryReport from "@/components/InjuryReport";
import RecentGames from "@/components/RecentGames";
import HeadToHeadSection from "@/components/HeadToHeadSection";
import { getNextGameData } from "@/lib/next-game";

// Don't run the heavy NBA fetch at build time (avoids 60s timeout). Render on first request
// and cache the result for 5 min so the site stays fast.
export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function Home() {
  let nextGame: NextGameResponse;

  try {
    // Call data layer directly (no self-fetch). This avoids an extra HTTP request
    // and reduces NBA API rate limit pressure in production.
    nextGame = await getNextGameData();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div>
          <h1>Next Cavs game</h1>
          <p>Oops, there was an error loading data: {message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 md:gap-24">
      <GameCard game={nextGame.game} />

      <main className="grid grid-cols-1 gap-12 md:gap-24">
        <StandingsTable
          cavaliers={nextGame.standings.cavaliers}
          opponent={nextGame.standings.opponent}
        />

        <InjuryReport
          cavaliers={nextGame.injuries.cavaliers}
          opponent={nextGame.injuries.opponent}
          opponentName={nextGame.game.opponent.teamName}
        />

        <RecentGames
          cavaliersRecentGames={nextGame.cavaliersRecentGames}
          opponentRecentGames={nextGame.opponentRecentGames}
          opponentName={nextGame.game.opponent.teamName}
          opponentTeamId={nextGame.game.opponent.teamId}
        />

        <HeadToHeadSection
          headToHead={
            Array.isArray(nextGame.headToHead) ? nextGame.headToHead : []
          }
          lastHeadToHeadBoxScore={nextGame.lastHeadToHeadBoxScore ?? null}
          opponentName={nextGame.game?.opponent?.teamName ?? undefined}
        />
      </main>

      {/* Footer */}
      <footer className="text-secondary text-sm mt-12">
        <p>
          Last updated:{" "}
          {new Date(nextGame.lastUpdated).toLocaleString("en-US", {
            timeZone: "America/New_York",
          })}
          . Not affiliated with the NBA.
        </p>
      </footer>
    </div>
  );
}
