import { cva } from "class-variance-authority";
import { GameSummary, TeamInfo } from "@/lib/nba/types";
import { format } from "date-fns";
import Section from "@/components/Section";

const resultBadge = cva("rounded-full w-2 h-2", {
  variants: {
    result: {
      W: "bg-green-500",
      L: "bg-red-500",
    },
  },
});

interface RecentGamesDataProps {
  title: string;
  games: GameSummary[];
  /** If set, used to infer home/away in summary (e.g. "Won 2 at home") */
  focusTeamId?: number;
  /** Shown when games.length === 0 (e.g. "No matchups available this season") */
  emptyMessage?: string;
}

const CAVALIERS_TEAM_ID = 1610612739;

interface RecentGamesProps {
  /** Section heading that encompasses both team blocks (e.g. "Last three games.") */
  sectionTitle?: string;
  cavaliersRecentGames: GameSummary[];
  opponentRecentGames: GameSummary[];
  opponentName: string;
  opponentTeamId: number;
}

/** Summary only for the games we show (no "streak" — we don't know what happened before). Adds location when accurate. */
function getSummarySentence(
  games: GameSummary[],
  focusTeamId?: number
): string | null {
  const list = games.filter(
    (g): g is GameSummary & { result: "W" | "L" } =>
      g.result === "W" || g.result === "L"
  );
  if (list.length === 0) return null;
  const n = list.length;
  const wins = list.filter((g) => g.result === "W").length;
  const losses = list.filter((g) => g.result === "L").length;
  const atHome = (g: GameSummary) =>
    focusTeamId != null && g.homeTeam?.teamId === focusTeamId;
  const lastHome = atHome(list[0]);
  const homeWins =
    focusTeamId != null
      ? list.filter((g) => g.result === "W" && atHome(g)).length
      : 0;
  const awayWins =
    focusTeamId != null
      ? list.filter((g) => g.result === "W" && !atHome(g)).length
      : 0;
  const homeLosses =
    focusTeamId != null
      ? list.filter((g) => g.result === "L" && atHome(g)).length
      : 0;
  const awayLosses =
    focusTeamId != null
      ? list.filter((g) => g.result === "L" && !atHome(g)).length
      : 0;
  const hasLocation = focusTeamId != null;

  if (wins === n && n >= 2) {
    if (hasLocation && homeWins === n) return `Won last ${n} at home`;
    if (hasLocation && awayWins === n) return `Won last ${n} on the road`;
    if (hasLocation && homeWins > 0 && awayWins > 0)
      return `Won last ${n} (home and away)`;
    return `Won last ${n}`;
  }
  if (losses === n && n >= 2) {
    if (hasLocation && homeLosses === n) return `Lost last ${n} at home`;
    if (hasLocation && awayLosses === n) return `Lost last ${n} on the road`;
    if (hasLocation && homeLosses > 0 && awayLosses > 0)
      return `Lost last ${n} regardless of location`;
    return `Lost last ${n}`;
  }
  if (wins >= 2 && losses >= 1) {
    if (hasLocation && homeWins === wins)
      return `Won ${wins} of last ${n} at home`;
    if (hasLocation && awayWins === wins)
      return `Won ${wins} of last ${n} on the road`;
    return `Won ${wins} of last ${n}`;
  }
  if (losses >= 2 && wins >= 1) {
    if (hasLocation && homeLosses === losses)
      return `Lost ${losses} of last ${n} at home`;
    if (hasLocation && awayLosses === losses)
      return `Lost ${losses} of last ${n} on the road`;
    if (hasLocation && homeLosses > 0 && awayLosses > 0)
      return `Lost ${losses} of last ${n} regardless of location`;
    return `Lost ${losses} of last ${n}`;
  }
  if (n === 2 && wins === 1) return "Won 1 of last 2";
  const lastResult = list[0]?.result;
  if (lastResult === "W") {
    if (lastHome) return "Won last at home";
    if (focusTeamId != null && !lastHome) return "Won last on the road";
    return "Won last game";
  }
  if (lastResult === "L") {
    if (lastHome) return "Lost last at home";
    if (focusTeamId != null && !lastHome) return "Lost last on the road";
    return "Lost last game";
  }
  return null;
}

function formatGameDate(dateStr: string | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  const s = String(dateStr).trim();
  if (!s) return "—";
  // Reject team IDs or other all-digit non-dates (e.g. 1610612739)
  if (/^\d+$/.test(s) && s.length !== 8) return "—";
  // NBA APIs: YYYYMMDD (e.g. 20250205)
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}`);
    if (!Number.isNaN(date.getTime())) return format(date, "MMM d, yyyy");
  }
  // ISO or other date strings (e.g. 2025-12-17T00:00:00, gameDateTimeEst from schedule)
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

/** Per-team recent games block (summary + list). Use inside RecentGames section. */
export function RecentGamesData({
  title,
  games = [],
  focusTeamId,
  emptyMessage,
}: RecentGamesDataProps) {
  const list = Array.isArray(games) ? games : [];
  const summary = getSummarySentence(list, focusTeamId);
  return (
    <div>
      <h3>{title}</h3>
      <div className="flex flex-col-reverse gap-2">
        {summary && (
          <p className="text-secondary font-mono text-sm italic">{summary}.</p>
        )}
        {list.length === 0 ? (
          <p>{emptyMessage ?? "No recent games available."}</p>
        ) : (
          <ul>
            {list.map((game) => {
              const awayLabel = formatTeamLabel(game.awayTeam);
              const homeLabel = formatTeamLabel(game.homeTeam);
              const awaySc =
                typeof game.awayScore === "number" ? game.awayScore : null;
              const homeSc =
                typeof game.homeScore === "number" ? game.homeScore : null;
              const hasAnyScore = awaySc !== null || homeSc !== null;
              const scoreText = hasAnyScore
                ? `${awaySc ?? "—"} - ${homeSc ?? "—"}`
                : null;
              const result = game.result;
              return (
                <li key={game.gameId}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-400">
                      {formatGameDate(game.gameDate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex-1 flex items-center gap-1">
                      {awayLabel} @ {homeLabel}
                      {(result === "W" || result === "L") && (
                        <span
                          className={resultBadge({ result })}
                          aria-label={result === "W" ? "win" : "loss"}
                        />
                      )}
                    </span>
                    {scoreText !== null && <span>{scoreText}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Section with last three games for Cavaliers and opponent. */
export default function RecentGames({
  cavaliersRecentGames,
  opponentRecentGames,
  opponentName,
  opponentTeamId,
}: RecentGamesProps) {
  return (
    <Section title="Last three games">
      <div className="grid grid-cols-2 gap-12">
        <RecentGamesData
          title="Cavaliers"
          games={cavaliersRecentGames}
          focusTeamId={CAVALIERS_TEAM_ID}
        />
        <RecentGamesData
          title={opponentName}
          games={opponentRecentGames}
          focusTeamId={opponentTeamId}
        />
      </div>
    </Section>
  );
}
