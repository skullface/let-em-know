import { NextGameResponse } from "@/lib/nba/types";
import GameCard from "@/components/GameCard";
import StandingsTable from "@/components/StandingsTable";
import InjuryReport from "@/components/InjuryReport";
import LineupCard from "@/components/LineupCard";
import BroadcastInfo from "@/components/BroadcastInfo";
import RecentGames from "@/components/RecentGames";
import HeadToHeadSection from "@/components/HeadToHeadSection";

async function getNextGame(): Promise<NextGameResponse> {
  // In server components, we can call the API route directly
  // or use the internal functions. For consistency with native apps,
  // we'll use the API route.
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/next-game`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail =
      typeof data?.detail === "string" ? data.detail : res.statusText;
    throw new Error(detail || "Failed to fetch next game");
  }

  return data as NextGameResponse;
}

export default async function Home() {
  let nextGame: NextGameResponse;

  try {
    nextGame = await getNextGame();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div>
          <h1>Next Cavs game</h1>
          <p>
            Oops, there was an error loading data for the next Cavs game.
            {message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <main>
      <div className="container mx-auto p-8 max-w-5xl">
        <div className="grid grid-cols-1 gap-24">
          <GameCard game={nextGame.game} />

          <BroadcastInfo
            broadcasts={nextGame.game.broadcasts}
            isHomeGame={nextGame.game.isHome}
          />

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
        </div>

        {/* Lineups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <LineupCard
            teamName="Cavaliers"
            players={nextGame.projectedLineups.cavaliers}
            isHome={nextGame.game.isHome}
          />
          <LineupCard
            teamName={nextGame.game.opponent.teamName}
            players={nextGame.projectedLineups.opponent}
            isHome={!nextGame.game.isHome}
          />
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm mt-12">
          <p>Last updated: {new Date(nextGame.lastUpdated).toLocaleString()}</p>
        </footer>
      </div>
    </main>
  );
}
