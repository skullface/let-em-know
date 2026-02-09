import { formatDistance } from "date-fns";
import { NextGameResponse } from "@/lib/nba/types";

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
    <div>
      <h1>
        Next Cavs game{" "}
        <b>{formatDistance(gameDate, now, { addSuffix: true })}</b>
      </h1>
      <div className="grid grid-cols-2 gap-12">
        <div>
          <h2 className="font-bold">
            Cleveland Cavaliers {game.isHome ? "vs" : "@"}{" "}
            {game.opponent.teamCity} {game.opponent.teamName}
          </h2>
          <span>{game.location}</span>
        </div>
        <time
          dateTime={gameDate.toISOString()}
          className="flex flex-col text-right"
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
    </div>
  );
}
