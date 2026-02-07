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
  const isPast = gameDate < now;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="mb-4 md:mb-0">
          <div className="text-sm text-zinc-400 mb-2">
            {isGameDay ? (
              <span className="font-semibold text-white">TODAY</span>
            ) : (
              formatET(gameDate, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {formatET(gameDate, {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}{" "}
            ET
          </div>
          <div className="text-lg text-zinc-300">
            {game.isHome ? "vs" : "@"} {game.opponent.teamCity}{" "}
            {game.opponent.teamName}
          </div>
          <div className="text-sm text-zinc-500 mt-2">{game.location}</div>
        </div>
        <div className="text-right">
          {!isPast && (
            <div className="text-3xl font-bold text-white">
              {formatDistance(gameDate, new Date(), { addSuffix: true })}
            </div>
          )}
          {isPast && (
            <div className="text-xl font-semibold text-green-500">
              Game Started
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
