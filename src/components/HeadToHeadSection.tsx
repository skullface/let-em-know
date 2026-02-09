'use client';

import { GameSummary, TeamInfo, LastH2HBoxScore } from '@/lib/nba/types';
import { format } from 'date-fns';
import Section from '@/components/Section';

interface HeadToHeadSectionProps {
  headToHead: GameSummary[];
  lastHeadToHeadBoxScore: LastH2HBoxScore | null;
  /** e.g. "Pacers" – used in empty state when there are no past matchups */
  opponentName?: string;
  emptyMessage?: string;
}

function formatGameDate(dateStr: string | undefined): string {
  if (dateStr == null || dateStr === '') return '—';
  const s = String(dateStr).trim();
  if (!s) return '—';
  if (/^\d+$/.test(s) && s.length !== 8) return '—';
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}`);
    if (!Number.isNaN(date.getTime())) return format(date, 'MMM d, yyyy');
  }
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

function GameCardRow({ game }: { game: GameSummary }) {
  if (!game) return null;
  const awayLabel = formatTeamLabel(game.awayTeam);
  const homeLabel = formatTeamLabel(game.homeTeam);
  const awaySc = typeof game.awayScore === 'number' ? game.awayScore : null;
  const homeSc = typeof game.homeScore === 'number' ? game.homeScore : null;
  const hasAnyScore = awaySc !== null || homeSc !== null;
  const scoreText = hasAnyScore ? `${awaySc ?? '—'} - ${homeSc ?? '—'}` : null;
  const result = game.result;
  return (
    <div
      className={`bg-gray-700/50 p-3 rounded border-l-4 ${
        result === 'W' ? 'border-green-500' : result === 'L' ? 'border-red-500' : 'border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-gray-400">{formatGameDate(game.gameDate)}</span>
        {result && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${
              result === 'W' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {result}
          </span>
        )}
      </div>
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="font-medium">
            {awayLabel} @ {homeLabel}
          </div>
        </div>
        {scoreText !== null && (
          <div className="text-right">
            <div className="font-bold">{scoreText}</div>
            <div className="text-xs text-gray-400">{game.status}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function TopPerformersBlock({
  box,
  firstGame,
}: {
  box: LastH2HBoxScore;
  firstGame: GameSummary;
}) {
  const homeLabel = formatTeamLabel(firstGame.homeTeam);
  const awayLabel = formatTeamLabel(firstGame.awayTeam);

  const renderStatColumn = (
    label: string,
    homePlayers: Array<{ playerName: string; personId: number; value: number }>,
    awayPlayers: Array<{ playerName: string; personId: number; value: number }>,
    gameHighPersonId: number | null
  ) => (
    <div className="mb-4 last:mb-0">
      <div className="text-xs font-semibold text-cavaliers-gold uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          {homePlayers.map((p, i) => (
            <div
              key={p.personId}
              className={`text-sm ${p.personId === gameHighPersonId ? 'font-bold text-cavaliers-gold' : 'text-gray-300'}`}
            >
              {i + 1}. {p.playerName} — {p.value}
            </div>
          ))}
          {homePlayers.length === 0 && <div className="text-sm text-gray-500">—</div>}
        </div>
        <div>
          {awayPlayers.map((p, i) => (
            <div
              key={p.personId}
              className={`text-sm ${p.personId === gameHighPersonId ? 'font-bold text-cavaliers-gold' : 'text-gray-300'}`}
            >
              {i + 1}. {p.playerName} — {p.value}
            </div>
          ))}
          {awayPlayers.length === 0 && <div className="text-sm text-gray-500">—</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-gray-600">
      <div className="text-sm font-semibold text-gray-400 mb-3">Top performers (last meeting)</div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="text-sm font-medium text-gray-300">{homeLabel}</div>
        <div className="text-sm font-medium text-gray-300">{awayLabel}</div>
      </div>
      {renderStatColumn('Points', box.homeTopPts, box.awayTopPts, box.gameHighPtsPersonId ?? null)}
      {renderStatColumn('Rebounds', box.homeTopReb, box.awayTopReb, box.gameHighRebPersonId ?? null)}
      {renderStatColumn('Assists', box.homeTopAst, box.awayTopAst, box.gameHighAstPersonId ?? null)}
    </div>
  );
}

export default function HeadToHeadSection({
  headToHead,
  lastHeadToHeadBoxScore,
  opponentName,
  emptyMessage,
}: HeadToHeadSectionProps) {
  const list = Array.isArray(headToHead) ? headToHead : [];
  const firstGame = list[0];
  const showTopPerformers =
    firstGame &&
    lastHeadToHeadBoxScore &&
    lastHeadToHeadBoxScore.gameId === firstGame.gameId;
  const defaultEmptyMessage = opponentName
    ? `No Cavaliers vs ${opponentName} matchups yet this season.`
    : 'No matchups available this season.';

  return (
    <Section title="Head-to-Head This Season">
      {list.length === 0 ? (
        <p className="text-gray-400 text-sm">{emptyMessage ?? defaultEmptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {list.map((game, index) => (
            <div key={game?.gameId || `h2h-${index}`}>
              <GameCardRow game={game} />
              {index === 0 && showTopPerformers && lastHeadToHeadBoxScore && (
                <div className="bg-gray-700/30 rounded-b-lg -mt-1 px-3 pb-3">
                  <TopPerformersBlock box={lastHeadToHeadBoxScore} firstGame={firstGame} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
