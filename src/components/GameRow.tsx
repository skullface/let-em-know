import { cva } from "class-variance-authority";
import { GameSummary, TeamInfo } from "@/lib/nba/types";
import { format } from "date-fns";

const resultBadge = cva("rounded-full w-2 h-2", {
  variants: {
    result: {
      W: "bg-green-500",
      L: "bg-red-500",
    },
  },
});

function formatGameDate(dateStr: string | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  const s = String(dateStr).trim();
  if (!s) return "—";
  if (/^\d+$/.test(s) && s.length !== 8) return "—";
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}`);
    if (!Number.isNaN(date.getTime())) return format(date, "MMM d, yyyy");
  }
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

function formatTeamLabel(team: TeamInfo): string {
  const tricode = team?.teamTricode?.trim();
  if (tricode && tricode.length <= 4 && !/^\d+$/.test(tricode)) return tricode;
  const city = team?.teamCity?.trim();
  const name = team?.teamName?.trim();
  if (city || name) return [city, name].filter(Boolean).join(" ");
  return "—";
}

export interface GameRowProps {
  game: GameSummary;
}

export default function GameRow({ game }: GameRowProps) {
  if (!game) return null;
  const awayLabel = formatTeamLabel(game.awayTeam);
  const homeLabel = formatTeamLabel(game.homeTeam);
  const awaySc = typeof game.awayScore === "number" ? game.awayScore : null;
  const homeSc = typeof game.homeScore === "number" ? game.homeScore : null;
  const hasAnyScore = awaySc !== null || homeSc !== null;
  const scoreText = hasAnyScore ? `${awaySc ?? "—"} - ${homeSc ?? "—"}` : null;
  const result = game.result;

  return (
    <>
      <span className="text-sm text-secondary uppercase">
        {formatGameDate(game.gameDate)}
      </span>
      <div className="flex justify-between items-center font-mono">
        <span className="flex-1 flex items-center gap-1.5 font-semibold">
          {awayLabel} @ {homeLabel}
          {(result === "W" || result === "L") && (
            <span
              className={resultBadge({ result })}
              aria-label={result === "W" ? "(win)" : "(loss)"}
            />
          )}
        </span>
        {scoreText !== null && <span>{scoreText}</span>}
      </div>
    </>
  );
}
