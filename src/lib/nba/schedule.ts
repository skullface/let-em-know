import { Game, TeamInfo } from './types';
import type { StandingsEntry, GameSummary } from './types';
import { getCached, setCached, CacheKeys, CACHE_TTL } from '../cache';

const CAVALIERS_TEAM_ID = 1610612739;

interface ScheduleResponse {
  meta: {
    version: number;
    request: string;
    time: string;
  };
  leagueSchedule: {
    seasonYear: string;
    leagueId: string;
    gameDates: Array<{
      gameDate: string;
      games: Game[];
    }>;
  };
}

export async function fetchSchedule(): Promise<ScheduleResponse> {
  const cached = await getCached<ScheduleResponse>(CacheKeys.schedule);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json',
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch schedule: ${response.statusText}`);
  }

  const data = await response.json();
  await setCached(CacheKeys.schedule, data, CACHE_TTL.SCHEDULE);
  return data;
}

// West team IDs for schedule-derived standings (conference not in schedule)
const WEST_TEAM_IDS = new Set([
  1610612740, 1610612742, 1610612743, 1610612744, 1610612745, 1610612746,
  1610612747, 1610612750, 1610612756, 1610612757, 1610612758, 1610612759,
  1610612760, 1610612762, 1610612763,
]);

/** Build minimal standings (wins/losses) from schedule when standings API fails. */
export function getStandingsFromSchedule(schedule: ScheduleResponse): StandingsEntry[] {
  const byTeam = new Map<
    number,
    { team: TeamInfo; date: string; wins: number; losses: number }
  >();
  for (const gameDate of schedule.leagueSchedule.gameDates) {
    for (const game of gameDate.games) {
      const date = game.gameDateTimeEst ?? gameDate.gameDate;
      const update = (team: TeamInfo) => {
        const w = team.wins ?? 0;
        const l = team.losses ?? 0;
        const existing = byTeam.get(team.teamId);
        if (!existing || date > existing.date) {
          byTeam.set(team.teamId, {
            team,
            date,
            wins: typeof w === 'number' ? w : parseInt(String(w), 10) || 0,
            losses: typeof l === 'number' ? l : parseInt(String(l), 10) || 0,
          });
        }
      };
      update(game.homeTeam);
      update(game.awayTeam);
    }
  }
  const entries: StandingsEntry[] = [];
  byTeam.forEach(({ team, wins, losses }) => {
    const total = wins + losses;
    const conference = WEST_TEAM_IDS.has(team.teamId) ? 'West' : 'East';
    entries.push({
      teamId: team.teamId,
      teamName: team.teamName ?? '',
      teamCity: team.teamCity ?? '',
      teamTricode: team.teamTricode ?? '—',
      wins,
      losses,
      winPct: total > 0 ? Math.round((wins / total) * 1000) / 1000 : 0,
      conferenceRank: 0,
      divisionRank: 0,
      leagueRank: 0,
      conference,
      division: '',
    });
  });
  return applyComputedRanks(entries);
}

/** Sort by winPct then wins and fill leagueRank and conferenceRank. */
function applyComputedRanks(entries: StandingsEntry[]): StandingsEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.wins - a.wins;
  });
  const withLeagueRank = sorted.map((entry, i) => ({ ...entry, leagueRank: i + 1 }));

  const east = withLeagueRank.filter((e) => e.conference === 'East').sort((a, b) => a.leagueRank - b.leagueRank);
  const west = withLeagueRank.filter((e) => e.conference === 'West').sort((a, b) => a.leagueRank - b.leagueRank);
  east.forEach((e, i) => {
    e.conferenceRank = i + 1;
  });
  west.forEach((e, i) => {
    e.conferenceRank = i + 1;
  });

  return withLeagueRank;
}

/** Coerce score to number (CDN may return string). */
function toScore(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeTeamInfo(t: TeamInfo): TeamInfo {
  const teamId = typeof t.teamId === 'string' ? parseInt(t.teamId, 10) : Number(t.teamId) || 0;
  let tricode = String(t.teamTricode ?? t.teamSlug ?? '').trim().toUpperCase().slice(0, 3);
  if (!tricode || /^\d+$/.test(tricode)) {
    const fromName = (t.teamCity ?? t.teamName ?? '').trim();
    tricode = fromName ? fromName.slice(0, 3).toUpperCase() : '—';
  }
  return {
    teamId,
    teamName: String(t.teamName ?? '').trim() || '—',
    teamCity: String(t.teamCity ?? '').trim() || '—',
    teamTricode: tricode || '—',
    teamSlug: String(t.teamSlug ?? '').trim().toLowerCase() || tricode.toLowerCase(),
  };
}

/** Opponent's last N completed games from schedule (correct dates + both scores). */
export function getOpponentRecentGamesFromSchedule(
  schedule: ScheduleResponse,
  opponentTeamId: number,
  limit: number = 3
): GameSummary[] {
  const oppId = Number(opponentTeamId);
  const collected: GameSummary[] = [];
  for (const gameDate of schedule.leagueSchedule.gameDates) {
    for (const game of gameDate.games) {
      const homeId = Number(game.homeTeam?.teamId);
      const awayId = Number(game.awayTeam?.teamId);
      const involvesOpponent = homeId === oppId || awayId === oppId;
      if (!involvesOpponent) continue;
      if (game.gameStatus !== 3) continue; // only final
      const homeScore = toScore(game.homeTeam?.score);
      const awayScore = toScore(game.awayTeam?.score);
      const homeTeam = normalizeTeamInfo(game.homeTeam);
      const awayTeam = normalizeTeamInfo(game.awayTeam);
      const dateStr = (game.gameDateTimeEst || gameDate.gameDate || '').toString().trim();
      collected.push({
        gameId: String(game.gameId ?? ''),
        gameDate: dateStr || new Date().toISOString(),
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        status: 'Final',
      });
    }
  }
  collected.sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime());
  return collected.slice(0, limit);
}

/** Head-to-head matchups this season (Cavaliers vs opponent) from schedule. Up to 4 games. Only final games with scores. */
export function getHeadToHeadFromSchedule(
  schedule: ScheduleResponse,
  opponentTeamId: number
): GameSummary[] {
  const now = new Date();
  const oppId = Number(opponentTeamId);
  const games: GameSummary[] = [];
  for (const gameDate of schedule.leagueSchedule.gameDates) {
    for (const game of gameDate.games) {
      const homeId = Number(game.homeTeam?.teamId);
      const awayId = Number(game.awayTeam?.teamId);
      const isCavsVsOpponent =
        (homeId === CAVALIERS_TEAM_ID && awayId === oppId) ||
        (awayId === CAVALIERS_TEAM_ID && homeId === oppId);
      if (!isCavsVsOpponent) continue;
      const gameTime = new Date(game.gameDateTimeUTC || game.gameDateTimeEst || gameDate.gameDate || 0);
      if (gameTime > now) continue;
      const isFinal = game.gameStatus === 3;
      if (!isFinal) continue;
      const homeScore = toScore(game.homeTeam?.score);
      const awayScore = toScore(game.awayTeam?.score);
      const homeTeam = normalizeTeamInfo(game.homeTeam);
      const awayTeam = normalizeTeamInfo(game.awayTeam);
      const dateStr = (game.gameDateTimeEst || gameDate.gameDate || '').toString().trim();
      games.push({
        gameId: String(game.gameId ?? ''),
        gameDate: dateStr || new Date().toISOString(),
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        status: 'Final',
      });
    }
  }
  games.sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime());
  return games.slice(0, 4);
}

export function findNextCavaliersGame(
  schedule: ScheduleResponse
): Game | null {
  const now = new Date();
  const allGames: Game[] = [];

  // Use gameDateTimeUTC for comparison: CDN's gameDateTimeEst is Eastern time
  // but stored with "Z" suffix, so parsing it as UTC gives the wrong moment.
  const gameTime = (g: Game) =>
    new Date(g.gameDateTimeUTC ?? g.gameDateTimeEst).getTime();

  for (const gameDate of schedule.leagueSchedule.gameDates) {
    for (const game of gameDate.games) {
      if (gameTime(game) >= now.getTime() || game.gameStatus === 2) {
        allGames.push(game);
      }
    }
  }

  const cavaliersGames = allGames.filter(
    (game) =>
      game.homeTeam.teamId === CAVALIERS_TEAM_ID ||
      game.awayTeam.teamId === CAVALIERS_TEAM_ID
  );

  if (cavaliersGames.length === 0) {
    return null;
  }

  cavaliersGames.sort((a, b) => gameTime(a) - gameTime(b));

  return cavaliersGames[0];
}

export function getOpponent(game: Game): TeamInfo {
  if (game.homeTeam.teamId === CAVALIERS_TEAM_ID) {
    return game.awayTeam;
  }
  return game.homeTeam;
}

export function isHomeGame(game: Game): boolean {
  return game.homeTeam.teamId === CAVALIERS_TEAM_ID;
}

export function getAllBroadcasts(game: Game) {
  const broadcasts: Array<{
    broadcasterScope: 'natl' | 'home' | 'away';
    broadcasterMedia: 'tv' | 'radio' | 'ott';
    broadcasterId: number;
    broadcasterDisplay: string;
    broadcasterAbbreviation: string;
    broadcasterDescription: string;
    broadcasterVideoLink?: string;
  }> = [];

  if (game.broadcasters) {
    if (game.broadcasters.nationalBroadcasters) {
      broadcasts.push(
        ...game.broadcasters.nationalBroadcasters.map((b) => ({
          ...b,
          broadcasterScope: 'natl' as const,
        }))
      );
    }
    if (game.broadcasters.homeTvBroadcasters) {
      broadcasts.push(
        ...game.broadcasters.homeTvBroadcasters.map((b) => ({
          ...b,
          broadcasterScope: 'home' as const,
        }))
      );
    }
    if (game.broadcasters.awayTvBroadcasters) {
      broadcasts.push(
        ...game.broadcasters.awayTvBroadcasters.map((b) => ({
          ...b,
          broadcasterScope: 'away' as const,
        }))
      );
    }
  }

  return broadcasts;
}
