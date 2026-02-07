import { GameSummary, TeamInfo } from '@/lib/nba/types';
import { format } from 'date-fns';

interface RecentGamesProps {
  title: string;
  games: GameSummary[];
  /** If set, used to infer home/away in summary (e.g. "Won 2 at home") */
  focusTeamId?: number;
  /** Shown when games.length === 0 (e.g. "No matchups available this season") */
  emptyMessage?: string;
}

/** Summary only for the games we show (no "streak" — we don't know what happened before). Adds location when accurate. */
function getSummarySentence(games: GameSummary[], focusTeamId?: number): string | null {
  const list = games.filter((g) => g.result === 'W' || g.result === 'L');
  if (list.length === 0) return null;
  const n = list.length;
  const wins = list.filter((g) => g.result === 'W').length;
  const losses = list.filter((g) => g.result === 'L').length;
  const atHome = (g: GameSummary) => focusTeamId != null && g.homeTeam?.teamId === focusTeamId;
  const lastHome = atHome(list[0]);
  const homeWins = focusTeamId != null ? list.filter((g) => g.result === 'W' && atHome(g)).length : 0;
  const awayWins = focusTeamId != null ? list.filter((g) => g.result === 'W' && !atHome(g)).length : 0;
  const homeLosses = focusTeamId != null ? list.filter((g) => g.result === 'L' && atHome(g)).length : 0;
  const awayLosses = focusTeamId != null ? list.filter((g) => g.result === 'L' && !atHome(g)).length : 0;
  const hasLocation = focusTeamId != null;

  if (wins === n && n >= 2) {
    if (hasLocation && homeWins === n) return `Won last ${n} at home`;
    if (hasLocation && awayWins === n) return `Won last ${n} on the road`;
    if (hasLocation && homeWins > 0 && awayWins > 0) return `Won last ${n} (home and away)`;
    return `Won last ${n}`;
  }
  if (losses === n && n >= 2) {
    if (hasLocation && homeLosses === n) return `Lost last ${n} at home`;
    if (hasLocation && awayLosses === n) return `Lost last ${n} on the road`;
    if (hasLocation && homeLosses > 0 && awayLosses > 0) return `Lost last ${n} regardless of location`;
    return `Lost last ${n}`;
  }
  if (wins >= 2 && losses >= 1) {
    if (hasLocation && homeWins === wins) return `Won ${wins} of last ${n} at home`;
    if (hasLocation && awayWins === wins) return `Won ${wins} of last ${n} on the road`;
    return `Won ${wins} of last ${n}`;
  }
  if (losses >= 2 && wins >= 1) {
    if (hasLocation && homeLosses === losses) return `Lost ${losses} of last ${n} at home`;
    if (hasLocation && awayLosses === losses) return `Lost ${losses} of last ${n} on the road`;
    if (hasLocation && homeLosses > 0 && awayLosses > 0) return `Lost ${losses} of last ${n} regardless of location`;
    return `Lost ${losses} of last ${n}`;
  }
  if (n === 2 && wins === 1) return 'Won 1 of last 2';
  if (list[0]?.result === 'W') {
    if (lastHome) return 'Won last at home';
    if (focusTeamId != null && !lastHome) return 'Won last on the road';
    return 'Won last game';
  }
  if (list[0]?.result === 'L') {
    if (lastHome) return 'Lost last at home';
    if (focusTeamId != null && !lastHome) return 'Lost last on the road';
    return 'Lost last game';
  }
  return null;
}

function formatGameDate(dateStr: string | undefined): string {
  if (dateStr == null || dateStr === '') return '—';
  const s = String(dateStr).trim();
  if (!s) return '—';
  // Reject team IDs or other all-digit non-dates (e.g. 1610612739)
  if (/^\d+$/.test(s) && s.length !== 8) return '—';
  // NBA APIs: YYYYMMDD (e.g. 20250205)
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}`);
    if (!Number.isNaN(date.getTime())) return format(date, 'MMM d, yyyy');
  }
  // ISO or other date strings (e.g. 2025-12-17T00:00:00, gameDateTimeEst from schedule)
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'MMM d, yyyy');
}

function formatTeamLabel(team: TeamInfo): string {
  const tricode = team?.teamTricode?.trim();
  if (tricode && tricode.length <= 4 && !/^\d+$/.test(tricode)) return tricode;
  const city = team?.teamCity?.trim();
  const name = team?.teamName?.trim();
  if (city || name) return [city, name].filter(Boolean).join(' ');
  return '—';
}

export default function RecentGames({ title, games = [], focusTeamId, emptyMessage }: RecentGamesProps) {
  const list = Array.isArray(games) ? games : [];
  const summary = getSummarySentence(list, focusTeamId);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-1 text-white">{title}</h2>
      {summary && (
        <p className="text-sm text-zinc-500 mb-4">{summary}</p>
      )}
      {!summary && list.length > 0 && <div className="mb-4" />}
      {list.length === 0 ? (
        <p className="text-zinc-500 text-sm">{emptyMessage ?? 'No recent games available'}</p>
      ) : (
        <div className="space-y-3">
          {list.map((game) => {
            const awayLabel = formatTeamLabel(game.awayTeam);
            const homeLabel = formatTeamLabel(game.homeTeam);
            const awaySc = typeof game.awayScore === 'number' ? game.awayScore : null;
            const homeSc = typeof game.homeScore === 'number' ? game.homeScore : null;
            const hasAnyScore = awaySc !== null || homeSc !== null;
            const scoreText = hasAnyScore
              ? `${awaySc ?? '—'} - ${homeSc ?? '—'}`
              : null;
            const result = game.result;
            return (
              <div
                key={game.gameId}
                className={`bg-zinc-800/50 border border-zinc-700/50 p-3 rounded border-l-4 ${
                  result === 'W' ? 'border-l-green-500' : result === 'L' ? 'border-l-red-500' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-zinc-500">
                    {formatGameDate(game.gameDate)}
                  </span>
                  {result && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        result === 'W' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                      }`}
                    >
                      {result}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-medium text-white">
                      {awayLabel} @ {homeLabel}
                    </div>
                  </div>
                  {scoreText !== null && (
                    <div className="text-right">
                      <div className="font-bold text-white">{scoreText}</div>
                      <div className="text-xs text-zinc-500">{game.status}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
