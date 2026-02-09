import { formatDistance } from "date-fns";
import { NextGameResponse } from "@/lib/nba/types";
import BroadcastInfo from "@/components/BroadcastInfo";

const ET = "America/New_York";

function formatET(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString("en-US", { ...options, timeZone: ET });
}

interface GameCardProps {
  game: NextGameResponse["game"];
}

export default function GameCard({ game }: GameCardProps) {
  const gameDate = new Date(game.dateTime);
  const now = new Date();
  const gameDateStrET = gameDate.toLocaleDateString("en-US", { timeZone: ET });
  const nowStrET = now.toLocaleDateString("en-US", { timeZone: ET });
  const isGameDay = gameDateStrET === nowStrET;

  return (
    <header>
      <h1 className="text-xl mb-4 text-balance">
        Next Cavs game{" "}
        <b>{formatDistance(gameDate, now, { addSuffix: true })}</b>
      </h1>
      <div className="grid grid-cols-2 gap-12 mb-8">
        <div className="flex flex-col gap-1">
          <h2 className="font-bold">
            Cavaliers {game.isHome ? "vs" : "@"} {game.opponent.teamName}
          </h2>
          <span>{game.location}</span>
        </div>
        <time
          dateTime={gameDate.toISOString()}
          className="flex flex-col gap-1 text-right"
        >
          <span className="font-bold">
            {isGameDay ? (
              <span>Today!</span>
            ) : (
              formatET(gameDate, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })
            )}
          </span>
          <span>
            {formatET(gameDate, {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}{" "}
            ET
          </span>
        </time>
      </div>

      <BroadcastInfo broadcasts={game.broadcasts} isHomeGame={game.isHome} />
    </header>
  );
}
