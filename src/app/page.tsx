import { NextGameResponse } from "@/lib/nba/types";
import GameCard from "@/components/GameCard";
import StandingsTable from "@/components/StandingsTable";
import InjuryReport from "@/components/InjuryReport";
import RecentGames from "@/components/RecentGames";
import StartingLineupSection from "@/components/StartingLineupSection";
import HeadToHeadSection from "@/components/HeadToHeadSection";
import { getNextGameData } from "@/lib/next-game";

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
    <div className="grid grid-cols-1 gap-24">
      <GameCard game={nextGame.game} />

      <main className="grid grid-cols-1 gap-24">
        <StandingsTable
          cavaliers={nextGame.standings.cavaliers}
          opponent={nextGame.standings.opponent}
        />

        <InjuryReport
          cavaliers={nextGame.injuries.cavaliers}
          opponent={nextGame.injuries.opponent}
          opponentName={nextGame.game.opponent.teamName}
        />

        <StartingLineupSection
          cavaliersPlayers={nextGame.projectedLineups.cavaliers}
          opponentPlayers={nextGame.projectedLineups.opponent}
          opponentName={nextGame.game.opponent.teamName}
          isHome={nextGame.game.isHome}
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
      <footer className="text-center text-secondary text-sm mt-24">
        <p>Last updated: {new Date(nextGame.lastUpdated).toLocaleString()}</p>
      </footer>
    </div>
  );
}
