import { Player } from './types';
import { fetchBoxScore, fetchTeamGameLog, fetchTeamRoster } from './gamelog';
import { InjuryEntry } from './types';
import { getCached, setCached, CacheKeys, CACHE_TTL } from '../cache';

const POSITION_ORDER: Record<string, number> = {
  PG: 1,
  SG: 2,
  SF: 3,
  PF: 4,
  C: 5,
};

type BoxScoreLike = {
  resultSets?: Array<{ name?: string; headers: string[]; rowSet: Array<Array<string | number>> }>;
  resultSet?: { name?: string; headers: string[]; rowSet: Array<Array<string | number>> };
  boxScoreTraditional?: {
    homeTeamId?: number;
    awayTeamId?: number;
    homeTeam?: { players?: Array<Record<string, unknown>> };
    awayTeam?: { players?: Array<Record<string, unknown>> };
  };
};

function headerIndex(headers: string[], name: string): number {
  const u = name.toUpperCase();
  const i = headers.findIndex((h) => String(h).toUpperCase() === u);
  if (i >= 0) return i;
  const snake = name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  return headers.findIndex((h) => String(h).toLowerCase() === snake);
}

/** Convert new boxScoreTraditional (homeTeam/awayTeam.players) to legacy headers + rowSet format. */
function boxScoreTraditionalToRowSet(
  trad: NonNullable<BoxScoreLike['boxScoreTraditional']>
): { headers: string[]; rowSet: Array<Array<string | number>> } {
  const headers = ['TEAM_ID', 'PLAYER_ID', 'PLAYER_NAME', 'POSITION', 'MIN', 'PTS', 'JERSEY_NUM'];
  const rowSet: Array<Array<string | number>> = [];
  const homeId = Number(trad.homeTeamId ?? 0);
  const awayId = Number(trad.awayTeamId ?? 0);
  const homePlayers = trad.homeTeam?.players ?? [];
  const awayPlayers = trad.awayTeam?.players ?? [];
  const push = (p: Record<string, unknown>, teamId: number) => {
    const personId = Number(p.personId ?? p.playerId ?? 0);
    const first = String(p.firstName ?? p.first_name ?? '').trim();
    const last = String(p.familyName ?? p.lastName ?? p.last_name ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ') || String(p.name ?? p.playerName ?? '').trim();
    const position = String(p.position ?? '').trim();
    const min = String(p.min ?? p.minutes ?? p.MIN ?? '').trim();
    const pts = Number(p.points ?? p.pts ?? p.PTS ?? 0) || 0;
    const jersey = String(p.jerseyNum ?? p.jersey_num ?? p.jerseyNumber ?? p.number ?? p.num ?? '').trim();
    rowSet.push([teamId, personId, name || `Player ${personId}`, position, min, pts, jersey || '']);
  };
  homePlayers.forEach((p) => push(p, homeId));
  awayPlayers.forEach((p) => push(p, awayId));
  return { headers, rowSet };
}

function getPlayerStatsResultSet(
  boxScore: BoxScoreLike
): { headers: string[]; rowSet: Array<Array<string | number>> } | undefined {
  const trad = (boxScore as BoxScoreLike & { boxScoreTraditional?: unknown }).boxScoreTraditional;
  if (trad && typeof trad === 'object' && (trad.homeTeam?.players?.length || trad.awayTeam?.players?.length)) {
    const converted = boxScoreTraditionalToRowSet(trad as NonNullable<BoxScoreLike['boxScoreTraditional']>);
    if (converted.rowSet.length > 0) return converted;
  }
  const sets = Array.isArray(boxScore.resultSets)
    ? boxScore.resultSets
    : boxScore.resultSet
      ? [boxScore.resultSet]
      : [];
  const playerStats = sets.find((rs) => (rs?.name ?? '').toLowerCase() === 'playerstats');
  if (playerStats?.headers?.length && playerStats?.rowSet?.length) return playerStats;
  const withStart = sets.find(
    (rs) =>
      rs?.headers?.length &&
      headerIndex(rs.headers, 'START_POSITION') >= 0 &&
      headerIndex(rs.headers, 'TEAM_ID') >= 0
  );
  if (withStart) return withStart;
  // V3 uses home_team_player_traditional + away_team_player_traditional (same headers, no "PlayerStats")
  const home = sets.find((rs) => (rs?.name ?? '').toLowerCase() === 'home_team_player_traditional');
  const away = sets.find((rs) => (rs?.name ?? '').toLowerCase() === 'away_team_player_traditional');
  if (home?.headers?.length && headerIndex(home.headers, 'TEAM_ID') >= 0) {
    const combined = {
      headers: home.headers,
      rowSet: [
        ...(home.rowSet ?? []),
        ...(away?.rowSet ?? []),
      ] as Array<Array<string | number>>,
    };
    const startIdx = headerIndex(combined.headers, 'START_POSITION');
    const commentIdx = headerIndex(combined.headers, 'COMMENT');
    const hasStarterInfo = startIdx >= 0 || (commentIdx >= 0 && combined.rowSet.some((r) => r[commentIdx]));
    if (combined.rowSet.length > 0 && (hasStarterInfo || combined.rowSet.length <= 10)) return combined;
  }
  return undefined;
}

/** Statuses that mean we should not list the player in the projected starting 5. */
const EXCLUDED_FROM_PROJECTED: InjuryEntry['status'][] = ['Out', 'Doubtful', 'Questionable'];

/** True if this player should be excluded from projected lineup (Out, Doubtful, or Questionable). */
function shouldExcludeFromProjectedLineup(player: Player, injuries: InjuryEntry[]): boolean {
  if (!injuries.length) return false;
  const fullName = `${player.firstName} ${player.lastName}`.trim().toLowerCase();
  const altName = `${player.lastName}, ${player.firstName}`.trim().toLowerCase();
  for (const inj of injuries) {
    if (!EXCLUDED_FROM_PROJECTED.includes(inj.status)) continue;
    const injName = inj.playerName.trim().toLowerCase();
    if (injName === fullName || injName === altName) return true;
    if (fullName.includes(injName) || injName.includes(fullName)) return true;
    const injParts = injName.split(/\s+/);
    if (injParts.length >= 2 && player.lastName.toLowerCase() === injParts[injParts.length - 1]) return true;
  }
  return false;
}

/**
 * Proposed starting 5 from recent games: who started in the team's last few games.
 * Cached per team. Used when the upcoming game has no box score yet.
 */
async function getRecentStarters(teamId: number): Promise<Player[]> {
  const cacheKey = CacheKeys.recentStarters(teamId);
  const cached = await getCached<Player[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  const games = await fetchTeamGameLog(teamId);
  const byPersonId = new Map<number, { player: Player; startCount: number }>();

  for (const g of games) {
    if (!g.gameId) continue;
    try {
      const boxScore = await fetchBoxScore(g.gameId);
      const playerStats = getPlayerStatsResultSet(boxScore);
      if (!playerStats) continue;
      const starters = extractStartersFromBoxScore(playerStats, teamId);
      for (const p of starters) {
        const existing = byPersonId.get(p.personId);
        if (existing) {
          existing.startCount += 1;
        } else {
          byPersonId.set(p.personId, { player: p, startCount: 1 });
        }
      }
    } catch {
      // skip this game
    }
  }

  // Sort by start count only — who actually started most. Don't force one-per-position
  // or we drop a star (e.g. second guard) in favor of filling a slot.
  const sorted = [...byPersonId.values()]
    .sort((a, b) => {
      if (b.startCount !== a.startCount) return b.startCount - a.startCount;
      return a.player.personId - b.player.personId; // stable tiebreaker
    })
    .map((x) => x.player);

  if (sorted.length > 0) {
    await setCached(cacheKey, sorted, CACHE_TTL.LINEUPS);
  }
  return sorted;
}

/** Top N players who may be in the starting lineup (recent starters, excluding Out/Doubtful/Questionable). Falls back to roster if no recent starter data. */
export async function getLineupCandidates(
  teamId: number,
  injuries: InjuryEntry[],
  limit: number = 8
): Promise<Player[]> {
  const recent = await getRecentStarters(teamId);
  const available = recent.filter((p) => !shouldExcludeFromProjectedLineup(p, injuries));
  if (available.length >= limit) return available.slice(0, limit);
  const roster = await fetchTeamRoster(teamId);
  const recentIds = new Set(available.map((p) => p.personId));
  const fromRoster = roster.filter(
    (p) => !recentIds.has(p.personId) && !shouldExcludeFromProjectedLineup(p, injuries)
  );
  return [...available, ...fromRoster].slice(0, limit);
}

export async function fetchProjectedLineup(
  gameId: string,
  teamId: number,
  injuries: InjuryEntry[]
): Promise<Player[]> {
  try {
    // 1. If game has started, use actual starters from box score (100% accurate at tipoff)
    const boxScore = await fetchBoxScore(gameId);
    const playerStats = getPlayerStatsResultSet(boxScore);

    if (playerStats) {
      const starters = extractStartersFromBoxScore(playerStats, teamId);
      if (starters.length === 5) {
        return starters;
      }
    }
  } catch {
    // Box score not available yet → use proposed lineup from recent games + injuries
  }

  // 2. Proposed starting 5: top 5 by start count, excluding Out/Doubtful/Questionable; fill from roster if needed
  const recentStarters = await getRecentStarters(teamId);
  const available = recentStarters.filter((p) => !shouldExcludeFromProjectedLineup(p, injuries));
  let projected: Player[] = available.slice(0, 5);

  const roster = await fetchTeamRoster(teamId);
  if (projected.length < 5) {
    const selectedIds = new Set(projected.map((p) => p.personId));
    const rosterCandidates = roster.filter(
      (p) => !selectedIds.has(p.personId) && !shouldExcludeFromProjectedLineup(p, injuries)
    );
    for (const p of rosterCandidates) {
      if (projected.length >= 5) break;
      projected.push(p);
      selectedIds.add(p.personId);
    }
  }

  const jerseyByPersonId = new Map<number, string>(
    roster.filter((p) => p.jerseyNumber).map((p) => [p.personId, p.jerseyNumber!])
  );
  projected = projected.slice(0, 5).map((p) => ({
    ...p,
    jerseyNumber: p.jerseyNumber ?? jerseyByPersonId.get(p.personId),
  }));

  return projected.sort(
    (a, b) => (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99)
  );
}

/** Parse "MIN" from box score (e.g. "32:45" or "32") to decimal minutes for sorting. */
function parseMinutes(min: string | number | undefined): number {
  if (min === undefined || min === null) return 0;
  const s = String(min).trim();
  if (!s) return 0;
  const [mins, secs] = s.split(':').map((x) => parseInt(x, 10) || 0);
  return mins + secs / 60;
}

function extractStartersFromBoxScore(
  playerStats: { headers: string[]; rowSet: Array<Array<string | number>> },
  teamId: number
): Player[] {
  const headers = playerStats.headers;
  const teamIdIndex = headerIndex(headers, 'TEAM_ID');
  const personIdIndex = headerIndex(headers, 'PLAYER_ID');
  const playerNameIndex = headerIndex(headers, 'PLAYER_NAME');
  const positionIndex = headerIndex(headers, 'POSITION');
  const startPositionIndex = headerIndex(headers, 'START_POSITION');
  const minIndex =
    headerIndex(headers, 'MIN') >= 0 ? headerIndex(headers, 'MIN') : headerIndex(headers, 'MINUTES');
  const ptsIndex = headerIndex(headers, 'PTS');
  const jerseyIndex =
    headerIndex(headers, 'JERSEY_NUM') >= 0
      ? headerIndex(headers, 'JERSEY_NUM')
      : headerIndex(headers, 'NUM');
  if (teamIdIndex < 0 || personIdIndex < 0) return [];

  const nameIdx = playerNameIndex >= 0 ? playerNameIndex : personIdIndex;
  let teamRows = playerStats.rowSet.filter((row) => Number(row[teamIdIndex]) === Number(teamId));

  if (startPositionIndex < 0) {
    teamRows = [...teamRows].sort((a, b) => {
      if (minIndex >= 0) {
        const minA = parseMinutes(a[minIndex] as string);
        const minB = parseMinutes(b[minIndex] as string);
        if (minB !== minA) return minB - minA;
      }
      if (ptsIndex >= 0) {
        const ptsA = Number(a[ptsIndex]) || 0;
        const ptsB = Number(b[ptsIndex]) || 0;
        return ptsB - ptsA;
      }
      return 0;
    });
  }

  const starters: Player[] = [];
  for (const row of teamRows) {
    const isStarter = startPositionIndex >= 0 ? row[startPositionIndex] : starters.length < 5;
    if (!isStarter) continue;
    const playerName = String(row[nameIdx] ?? '').trim() || `Player ${row[personIdIndex]}`;
    const parts = playerName.split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') ?? '';
    const jerseyNumber =
      jerseyIndex >= 0 && row[jerseyIndex] !== undefined && row[jerseyIndex] !== ''
        ? String(row[jerseyIndex]).trim()
        : undefined;
    starters.push({
      personId: Number(row[personIdIndex]),
      firstName,
      lastName,
      position: positionIndex >= 0 ? String(row[positionIndex] ?? '').trim() : '',
      ...(jerseyNumber ? { jerseyNumber } : {}),
    });
  }

  return starters.sort(
    (a, b) => (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99)
  );
}
