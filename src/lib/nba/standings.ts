import { StandingsEntry } from './types';
import { getCached, setCached, CacheKeys, CACHE_TTL } from '../cache';

// NBA team ID to tricode (leaguestandingsv3 does not return TeamTricode)
const TEAM_TRICODES: Record<number, string> = {
  1610612737: 'ATL',
  1610612738: 'BOS',
  1610612739: 'CLE',
  1610612740: 'NOP',
  1610612741: 'CHI',
  1610612742: 'DAL',
  1610612743: 'DEN',
  1610612744: 'GSW',
  1610612745: 'HOU',
  1610612746: 'LAC',
  1610612747: 'LAL',
  1610612748: 'MIA',
  1610612749: 'MIL',
  1610612750: 'MIN',
  1610612751: 'BKN',
  1610612752: 'NYK',
  1610612753: 'ORL',
  1610612754: 'IND',
  1610612755: 'PHI',
  1610612756: 'PHX',
  1610612757: 'POR',
  1610612758: 'SAC',
  1610612759: 'SAS',
  1610612760: 'OKC',
  1610612761: 'TOR',
  1610612762: 'UTA',
  1610612763: 'MEM',
  1610612764: 'WAS',
  1610612765: 'DET',
  1610612766: 'CHA',
};

function getVal(row: Array<string | number>, headers: string[], name: string): string | number | undefined {
  const upper = name.toUpperCase();
  const i = headers.findIndex((h) => String(h).toUpperCase() === upper);
  return i >= 0 ? row[i] : undefined;
}

function rowToStandingsEntry(row: Array<string | number>, headers: string[]): StandingsEntry {
  const teamId = Number(getVal(row, headers, 'TeamID')) || 0;
  const wins = Number(getVal(row, headers, 'WINS')) || 0;
  const losses = Number(getVal(row, headers, 'LOSSES')) || 0;
  const winPct = Number(getVal(row, headers, 'WinPCT')) || 0;
  const leagueRank = Number(getVal(row, headers, 'LeagueRank')) || 0;
  const divisionRank = Number(getVal(row, headers, 'DivisionRank')) || 0;
  const playoffRank = Number(getVal(row, headers, 'PlayoffRank')) || 0;
  const conference = String(getVal(row, headers, 'Conference') ?? '').trim() as 'East' | 'West';
  const division = String(getVal(row, headers, 'Division') ?? '').trim();

  return {
    teamId,
    teamName: String(getVal(row, headers, 'TeamName') ?? ''),
    teamCity: String(getVal(row, headers, 'TeamCity') ?? ''),
    teamTricode: TEAM_TRICODES[teamId] ?? (String(getVal(row, headers, 'TeamSlug') ?? '').slice(0, 3).toUpperCase() || '—'),
    wins,
    losses,
    winPct,
    conferenceRank: playoffRank || leagueRank,
    divisionRank,
    leagueRank,
    conference: conference === 'West' ? 'West' : 'East',
    division,
  };
}

export async function fetchStandings(): Promise<StandingsEntry[]> {
  const cached = await getCached<StandingsEntry[]>(CacheKeys.standings);
  if (cached) {
    return cached;
  }

  const currentSeason = '2025-26';
  const url = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${currentSeason}&SeasonType=Regular%20Season`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://www.nba.com',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch standings: ${response.statusText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Standings: invalid JSON response');
  }

  // API can return resultSet (singular) or resultSets (array); find the Standings table
  let headers: string[] = [];
  let rowSet: Array<Array<string | number>> | null = null;

  const resultSet = data?.resultSet;
  const resultSets = data?.resultSets;

  if (resultSet?.headers && resultSet?.rowSet) {
    headers = resultSet.headers;
    rowSet = resultSet.rowSet;
  } else if (Array.isArray(resultSets) && resultSets.length > 0) {
    // Find the result set named "Standings" or use the first with rows
    const standingsSet =
      resultSets.find((rs: any) => (rs?.name ?? '').toLowerCase() === 'standings') ??
      resultSets.find((rs: any) => Array.isArray(rs?.rowSet) && rs.rowSet.length > 0) ??
      resultSets[0];
    headers = Array.isArray(standingsSet?.headers) ? standingsSet.headers : [];
    rowSet = Array.isArray(standingsSet?.rowSet) ? standingsSet.rowSet : null;
  }

  if (!rowSet || rowSet.length === 0) {
    const debugPayload = {
      keys: data ? Object.keys(data) : [],
      resultSetKeys: resultSet ? Object.keys(resultSet) : [],
      resultSetsLen: resultSets?.length,
      firstSetName: resultSets?.[0]?.name,
      firstSetHeaders: resultSets?.[0]?.headers?.slice?.(0, 15),
    };
    console.warn('[standings] No rowSet or empty:', debugPayload);
    if (process.env.NODE_ENV === 'development') {
      console.warn('[standings] Raw response sample:', JSON.stringify(data).slice(0, 500));
    }
    return [];
  }

  let standings: StandingsEntry[] = rowSet.map((row: Array<string | number>) =>
    rowToStandingsEntry(row, headers)
  );

  if (standings.some((s) => s.leagueRank === 0)) {
    standings = applyComputedRanks(standings);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[standings] Parsed %s entries', standings.length);
  }
  await setCached(CacheKeys.standings, standings, CACHE_TTL.STANDINGS);
  return standings;
}

/** Compute league (and conference) rank from winPct/wins when API omits them. */
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

export function findTeamStandings(
  standings: StandingsEntry[],
  teamId: number
): StandingsEntry | null {
  return standings.find((s) => s.teamId === teamId) || null;
}
