import { GameSummary, TeamInfo, LastH2HBoxScore, Player } from './types';
import { getCached, setCached, CacheKeys, CACHE_TTL } from '../cache';

interface GameLogResponse {
  resultSet: {
    headers: string[];
    rowSet: Array<Array<string | number>>;
  };
}

interface BoxScoreResponse {
  resultSets: Array<{
    name: string;
    headers: string[];
    rowSet: Array<Array<string | number>>;
  }>;
}

export async function fetchTeamGameLog(
  teamId: number,
  season: string = '2025-26'
): Promise<GameSummary[]> {
  const cacheKey = CacheKeys.opponentGames(teamId);
  const cached = await getCached<GameSummary[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `https://stats.nba.com/stats/teamgamelog?DateFrom=&DateTo=&LeagueID=00&Season=${season}&SeasonType=Regular%20Season&TeamID=${teamId}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://www.nba.com',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch team game log: ${response.statusText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (e) {
    console.warn('[gamelog] Team game log: invalid JSON response', e);
    return [];
  }
  if (!data || typeof data !== 'object') {
    console.warn('[gamelog] Team game log: response is not an object', typeof data, data);
    return [];
  }

  // Handle different response structures (resultSet vs resultSets array)
  const rawSet = data.resultSet ?? data.resultSets?.[0];
  const rowSet = Array.isArray(rawSet?.rowSet) ? rawSet.rowSet : null;

  if (!rowSet || rowSet.length === 0) {
    const debugPayload: Record<string, unknown> = {
      keys: data ? Object.keys(data) : [],
      hasResultSet: !!data?.resultSet,
      hasResultSets: !!data?.resultSets,
      resultSetsLen: data?.resultSets?.length,
    };
    if (data?.resultSets?.[0]) {
      const rs = data.resultSets[0];
      debugPayload.firstResultSetKeys = rs ? Object.keys(rs) : [];
      debugPayload.firstResultSetName = rs?.name;
      debugPayload.firstResultSetRowSetLength = Array.isArray(rs?.rowSet) ? rs.rowSet.length : 'not-array';
    }
    if (data?.resultSet) {
      debugPayload.resultSetKeys = Object.keys(data.resultSet);
    }
    console.warn('[gamelog] Unexpected API response structure for team game log (teamId=%s):', teamId, debugPayload);
    if (process.env.NODE_ENV === 'development') {
      console.warn('[gamelog] Raw response sample (first 500 chars):', JSON.stringify(data).slice(0, 500));
    }
    return [];
  }

  const headers: string[] = Array.isArray(rawSet?.headers) ? rawSet.headers : [];
  const getValH = (row: Array<string | number>, name: string) => getVal(row, headers, name);

  const games: GameSummary[] = rowSet
    .slice(0, 3)
    .map((row: Array<string | number>) => {
      const gameId = String(getValH(row, 'GAME_ID') ?? '');
      const gameDate = String(getValH(row, 'GAME_DATE') ?? '');
      const matchup = String(getValH(row, 'MATCHUP') ?? '');
      const pts = Number(getValH(row, 'PTS')) || 0;
      const [awayTeam, homeTeam] = parseMatchup(matchup);
      const rowTeamAbbrev = String(getValH(row, 'TEAM_ABBREVIATION') ?? '').trim().toUpperCase();
      const atParts = matchup.split(/\s+@\s+/);
      const vsParts = matchup.split(/\s+vs\.\s+/);
      const isRowTeamAway =
        (atParts.length === 2 && atParts[0]?.trim().toUpperCase() === rowTeamAbbrev) ||
        (vsParts.length === 2 && vsParts[1]?.trim().toUpperCase() === rowTeamAbbrev);
      const isRowTeamHome =
        (atParts.length === 2 && atParts[1]?.trim().toUpperCase() === rowTeamAbbrev) ||
        (vsParts.length === 2 && vsParts[0]?.trim().toUpperCase() === rowTeamAbbrev);
      const homeScore = isRowTeamHome ? pts : undefined;
      const awayScore = isRowTeamAway ? pts : undefined;
      return {
        gameId,
        gameDate,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        status: 'Final',
      };
    })
    .reverse();

  if (process.env.NODE_ENV === 'development') {
    console.log('[gamelog] fetchTeamGameLog(teamId=%s): parsed %s games, headers=%s', teamId, games.length, headers?.length ? headers.slice(0, 8) : []);
  }
  await setCached(cacheKey, games, CACHE_TTL.OPPONENT_GAMES);
  return games;
}

function parseMatchup(matchup: string): [TeamInfo, TeamInfo] {
  // Format: "CLE vs. BOS" or "CLE @ BOS"
  const parts = matchup.split(/\s+(vs\.|@)\s+/);
  const awayTricode = parts[0];
  const homeTricode = parts[2];

  return [
    { teamId: 0, teamName: '', teamCity: '', teamTricode: awayTricode, teamSlug: '' },
    { teamId: 0, teamName: '', teamCity: '', teamTricode: homeTricode, teamSlug: '' },
  ];
}

function getVal(row: Array<string | number>, headers: string[], name: string): string | number | undefined {
  const upper = name.toUpperCase();
  const i = headers.findIndex((h) => String(h).toUpperCase() === upper);
  return i >= 0 ? row[i] : undefined;
}

export async function fetchHeadToHeadGames(
  teamId1: number,
  teamId2: number,
  season: string = '2025-26'
): Promise<GameSummary[]> {
  const cacheKey = CacheKeys.headToHead(teamId1, teamId2);
  const cached = await getCached<GameSummary[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `https://stats.nba.com/stats/leaguegamefinder?Season=${season}&SeasonType=Regular%20Season&TeamID=${teamId1}&vsTeamID=${teamId2}&PlayerOrTeam=T&OrderBy=GAME_DATE%20DESC`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://www.nba.com',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch head-to-head games: ${response.statusText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (e) {
    console.warn('[gamelog] Head-to-head: invalid JSON response', e);
    return [];
  }
  if (!data || typeof data !== 'object') {
    console.warn('[gamelog] Head-to-head: response is not an object', typeof data, data);
    return [];
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[gamelog] fetchHeadToHeadGames raw response keys:', data ? Object.keys(data) : []);
    if (data?.resultSets?.length) {
      console.log('[gamelog] resultSets[0] keys:', Object.keys(data.resultSets[0] || {}), 'name=', data.resultSets[0]?.name);
    }
  }

  let rawSet = data.resultSet ?? data.resultSets?.[0];
  if (!rawSet && Array.isArray(data.resultSets)) {
    rawSet = data.resultSets.find(
      (rs: any) =>
        Array.isArray(rs?.rowSet) &&
        rs.rowSet.length > 0 &&
        Array.isArray(rs?.headers) &&
        (rs.headers as string[]).some((h: string) => String(h).toUpperCase() === 'GAME_ID')
    ) ?? data.resultSets[0];
  }
  const headers: string[] = Array.isArray(rawSet?.headers) ? rawSet.headers : [];
  const rowSet = Array.isArray(rawSet?.rowSet) ? rawSet.rowSet : null;

  if (!rowSet || rowSet.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[gamelog] Head-to-head: no rowSet or empty. data keys=', data ? Object.keys(data) : [], 'rawSet=', rawSet ? Object.keys(rawSet) : 'null', 'sample=', JSON.stringify(data).slice(0, 400));
    }
    await setCached(cacheKey, [], CACHE_TTL.HEAD_TO_HEAD);
    return [];
  }

  // LeagueGameFinder returns one row per team per game (so 2 rows per game). Group by GAME_ID.
  const byGame = new Map<string, Array<{ row: Array<string | number>; headers: string[] }>>();
  for (const row of rowSet) {
    const gameId = String(getVal(row, headers, 'GAME_ID') ?? '');
    if (!gameId) continue;
    if (!byGame.has(gameId)) byGame.set(gameId, []);
    byGame.get(gameId)!.push({ row, headers });
  }

  const games: GameSummary[] = [];
  for (const [, rows] of byGame) {
    if (rows.length < 2) continue;
    const h = rows[0].headers;
    const r0 = rows[0].row;
    const r1 = rows[1].row;
    const m0 = String(getVal(r0, h, 'MATCHUP') ?? '').trim();
    const m1 = String(getVal(r1, h, 'MATCHUP') ?? '').trim();
    const gameId = String(getVal(r0, h, 'GAME_ID') ?? '');
    const gameDate = String(getVal(r0, h, 'GAME_DATE') ?? '').trim();

    const abbrevFromMatchup = (matchupStr: string, wantHome: boolean): string => {
      const vs = matchupStr.split(/\s+vs\.\s+/);
      const at = matchupStr.split(/\s+@\s+/);
      if (vs.length === 2) {
        const first = vs[0]?.trim().slice(0, 3) ?? '';
        const second = vs[1]?.trim().slice(0, 3) ?? '';
        return wantHome ? first : second;
      }
      if (at.length === 2) {
        const first = at[0]?.trim().slice(0, 3) ?? '';
        const second = at[1]?.trim().slice(0, 3) ?? '';
        return wantHome ? second : first;
      }
      return '';
    };

    const rowToTeamInfo = (row: Array<string | number>, matchupStr: string, isHome: boolean): TeamInfo => {
      let abbrev = String(getVal(row, h, 'TEAM_ABBREVIATION') ?? '').trim();
      if (!abbrev || /^\d+$/.test(abbrev)) abbrev = abbrevFromMatchup(matchupStr, isHome);
      const teamId = Number(getVal(row, h, 'TEAM_ID')) || 0;
      const teamName = String(getVal(row, h, 'TEAM_NAME') ?? '').trim() || abbrev;
      const teamCity = String(getVal(row, h, 'TEAM_CITY') ?? '').trim();
      const teamTricode = abbrev && !/^\d+$/.test(abbrev) ? abbrev.slice(0, 3) : '—';
      return {
        teamId,
        teamName: teamName || '—',
        teamCity: teamCity || '—',
        teamTricode: teamTricode || '—',
        teamSlug: (abbrev || '—').toLowerCase(),
      };
    };

    const isHome0 = m0.includes(' vs. ');
    const awayRow = isHome0 ? r1 : r0;
    const homeRow = isHome0 ? r0 : r1;
    const awayMatchup = isHome0 ? m1 : m0;
    const homeMatchup = isHome0 ? m0 : m1;
    const awayTeam = rowToTeamInfo(awayRow, awayMatchup, false);
    const homeTeam = rowToTeamInfo(homeRow, homeMatchup, true);

    const homeScore = Number(getVal(homeRow, h, 'PTS')) || 0;
    const awayScore = Number(getVal(awayRow, h, 'PTS')) || 0;

    const validGameId = gameId.length >= 10 && /^\d+$/.test(gameId);
    if (!validGameId) continue;

    games.push({
      gameId,
      gameDate: gameDate || '—',
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status: 'Final',
    });
  }

  // Sort by date descending; take up to 4 (max H2H games in a season)
  games.sort((a, b) => (b.gameDate > a.gameDate ? 1 : -1));
  const result = games.slice(0, 4);

  if (process.env.NODE_ENV === 'development') {
    console.log('[gamelog] fetchHeadToHeadGames: parsed %s games (returning %s)', games.length, result.length);
  }
  await setCached(cacheKey, result, CACHE_TTL.HEAD_TO_HEAD);
  return result;
}

export async function fetchBoxScore(gameId: string): Promise<BoxScoreResponse> {
  const url = `https://stats.nba.com/stats/boxscoretraditionalv3?GameID=${gameId}&StartPeriod=0&EndPeriod=14&StartRange=0&EndRange=2147483647&RangeType=0`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://www.nba.com',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch box score: ${response.statusText}`);
  }

  return await response.json();
}

/** Team roster (for projected lineups). Season format: "2024-25". */
export async function fetchTeamRoster(
  teamId: number,
  season: string = '2025-26'
): Promise<Player[]> {
  const cacheKey = CacheKeys.roster(teamId);
  const cached = await getCached<Player[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  const url = `https://stats.nba.com/stats/commonteamroster?LeagueID=00&Season=${encodeURIComponent(season)}&TeamID=${teamId}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://www.nba.com',
      Accept: 'application/json',
    },
  });
  if (!response.ok) return [];

  let data: { resultSets?: Array<{ name: string; headers: string[]; rowSet: Array<Array<string | number>> }> };
  try {
    data = await response.json();
  } catch {
    return [];
  }
  const rosterSet = data?.resultSets?.find((rs) => rs?.name === 'CommonTeamRoster');
  if (!rosterSet?.headers?.length || !rosterSet?.rowSet?.length) return [];

  const headers = rosterSet.headers;
  const pidIdx = headers.findIndex((h) => String(h).toUpperCase() === 'PLAYER_ID');
  const nameIdx = headers.findIndex((h) => String(h).toUpperCase() === 'PLAYER');
  const posIdx = headers.findIndex((h) => String(h).toUpperCase() === 'POSITION');
  const numIdx = headers.findIndex((h) => String(h).toUpperCase() === 'NUM');
  if (pidIdx < 0 || nameIdx < 0) return [];

  const players: Player[] = rosterSet.rowSet.map((row) => {
    const fullName = String(row[nameIdx] ?? '').trim();
    const parts = fullName.split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') ?? '';
    return {
      personId: Number(row[pidIdx]) || 0,
      firstName,
      lastName,
      position: posIdx >= 0 ? String(row[posIdx] ?? '').trim() : '',
      jerseyNumber: numIdx >= 0 ? String(row[numIdx] ?? '').trim() || undefined : undefined,
    };
  });
  await setCached(cacheKey, players, CACHE_TTL.ROSTER);
  return players;
}

/** CDN box score: game.homeTeam.players[].{ personId, name, statistics: { points, reboundsTotal, assists } } */
interface CDNBoxScorePlayer {
  personId: number;
  name: string;
  statistics?: {
    points?: number;
    reboundsTotal?: number;
    assists?: number;
  };
}
interface CDNBoxScoreResponse {
  game?: {
    gameId?: string;
    homeTeam?: { teamId: number; players?: CDNBoxScorePlayer[] };
    awayTeam?: { teamId: number; players?: CDNBoxScorePlayer[] };
  };
}

/** Fetch box score from NBA CDN (reliable); returns null if missing or error. */
async function fetchBoxScoreFromCDN(gameId: string): Promise<CDNBoxScoreResponse | null> {
  const cleanId = String(gameId || '').trim();
  if (!cleanId) return null;
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${cleanId}.json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.game?.homeTeam?.players && data?.game?.awayTeam?.players) return data as CDNBoxScoreResponse;
    return null;
  } catch {
    return null;
  }
}

/** Build rows { personId, playerName, teamId, points, rebounds, assists } from CDN box score. */
function parseCDNBoxScoreToRows(cdn: CDNBoxScoreResponse): { rows: Array<{ personId: number; playerName: string; teamId: number; points: number; rebounds: number; assists: number }>; homeTeamId: number; awayTeamId: number } {
  const homeTeam = cdn?.game?.homeTeam;
  const awayTeam = cdn?.game?.awayTeam;
  const homeTeamId = homeTeam?.teamId ?? 0;
  const awayTeamId = awayTeam?.teamId ?? 0;
  const rows: Array<{ personId: number; playerName: string; teamId: number; points: number; rebounds: number; assists: number }> = [];
  for (const p of homeTeam?.players ?? []) {
    const stats = p?.statistics ?? {};
    const points = Number(stats.points ?? 0) || 0;
    const rebounds = Number(stats.reboundsTotal ?? 0) || 0;
    const assists = Number(stats.assists ?? 0) || 0;
    if (!p?.name || !(points > 0 || rebounds > 0 || assists > 0)) continue;
    rows.push({
      personId: Number(p.personId) || 0,
      playerName: String(p.name ?? '').trim(),
      teamId: homeTeamId,
      points,
      rebounds,
      assists,
    });
  }
  for (const p of awayTeam?.players ?? []) {
    const stats = p?.statistics ?? {};
    const points = Number(stats.points ?? 0) || 0;
    const rebounds = Number(stats.reboundsTotal ?? 0) || 0;
    const assists = Number(stats.assists ?? 0) || 0;
    if (!p?.name || !(points > 0 || rebounds > 0 || assists > 0)) continue;
    rows.push({
      personId: Number(p.personId) || 0,
      playerName: String(p.name ?? '').trim(),
      teamId: awayTeamId,
      points,
      rebounds,
      assists,
    });
  }
  return { rows, homeTeamId, awayTeamId };
}

/** Get top 3 players by PTS, REB, AST per team and game highs for the most recent H2H box score */
export async function getBoxScoreTopPerformers(
  gameId: string,
  homeTeamId: number,
  awayTeamId: number
): Promise<LastH2HBoxScore | null> {
  const cacheKey = `nba:boxscore-tops:${gameId}`;
  const cached = await getCached<LastH2HBoxScore>(cacheKey);
  if (cached) return cached;

  // Prefer CDN box score (same domain as schedule, reliable)
  const cdn = await fetchBoxScoreFromCDN(gameId);
  if (cdn) {
    const { rows, homeTeamId: hId, awayTeamId: aId } = parseCDNBoxScoreToRows(cdn);
    if (rows.length > 0 && Number(hId) === Number(homeTeamId) && Number(aId) === Number(awayTeamId)) {
      const topN = (arr: typeof rows, key: 'points' | 'rebounds' | 'assists', n: number) =>
        [...arr].sort((a, b) => b[key] - a[key]).slice(0, n).map((p) => ({ playerName: p.playerName, personId: p.personId, value: p[key] }));
      const homeRows = rows.filter((r) => r.teamId === homeTeamId);
      const awayRows = rows.filter((r) => r.teamId === awayTeamId);
      const gameHighPts = rows.length ? [...rows].sort((a, b) => b.points - a.points)[0] : null;
      const gameHighReb = rows.length ? [...rows].sort((a, b) => b.rebounds - a.rebounds)[0] : null;
      const gameHighAst = rows.length ? [...rows].sort((a, b) => b.assists - a.assists)[0] : null;
      const result: LastH2HBoxScore = {
        gameId,
        homeTeamId,
        awayTeamId,
        homeTopPts: topN(homeRows, 'points', 3),
        homeTopReb: topN(homeRows, 'rebounds', 3),
        homeTopAst: topN(homeRows, 'assists', 3),
        awayTopPts: topN(awayRows, 'points', 3),
        awayTopReb: topN(awayRows, 'rebounds', 3),
        awayTopAst: topN(awayRows, 'assists', 3),
        gameHighPtsPersonId: gameHighPts?.personId ?? null,
        gameHighRebPersonId: gameHighReb?.personId ?? null,
        gameHighAstPersonId: gameHighAst?.personId ?? null,
      };
      await setCached(cacheKey, result, CACHE_TTL.SCOREBOARD);
      return result;
    }
  }

  // Fallback: stats.nba.com box score
  let data: BoxScoreResponse & { resultSet?: { headers: string[]; rowSet: Array<Array<string | number>> } };
  try {
    data = await fetchBoxScore(gameId);
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[gamelog] getBoxScoreTopPerformers fetch failed:', e);
    }
    return null;
  }

  const rawSets = Array.isArray(data?.resultSets)
    ? data.resultSets
    : data?.resultSet
      ? [{ ...data.resultSet, name: 'PlayerStats' }]
      : [];
  const hasPtsOrPoints = (h: string) => /^pts$/i.test(String(h).trim()) || /points/i.test(String(h));
  const hasPersonOrPlayer = (h: string) => /person_id|player_id/i.test(String(h)) || /^person$/i.test(String(h).trim());
  const playerSets = rawSets.filter(
    (rs) =>
      Array.isArray(rs?.headers) &&
      Array.isArray(rs?.rowSet) &&
      rs.rowSet.length > 0 &&
      rs.headers.some((h: string) => hasPtsOrPoints(h)) &&
      rs.headers.some((h: string) => hasPersonOrPlayer(h))
  );
  const playerSet =
    playerSets.find((rs) => (rs?.name ?? '').toLowerCase() === 'playerstats') ??
    playerSets[0] ??
    rawSets.find((rs) => (rs?.name ?? '').toLowerCase().includes('player'));
  if (!playerSet?.headers?.length || !playerSet?.rowSet?.length) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[gamelog] getBoxScoreTopPerformers: no player set found. resultSets count=', rawSets.length, 'names=', rawSets.map((r) => r?.name));
    }
    return null;
  }

  const headers = playerSet.headers as string[];
  const getVal = (row: Array<string | number>, ...names: string[]): string | number | undefined => {
    for (const name of names) {
      const i = headers.findIndex((h) => String(h).toUpperCase() === name.toUpperCase());
      if (i >= 0 && row[i] !== undefined) return row[i];
      const j = headers.findIndex((h) => String(h).toLowerCase().includes(name.toLowerCase()));
      if (j >= 0 && row[j] !== undefined) return row[j];
    }
    return undefined;
  };
  const parseRow = (row: Array<string | number>) => {
    const personId = Number(getVal(row, 'PERSON_ID', 'PLAYER_ID') ?? 0) || 0;
    const playerName = String(getVal(row, 'PLAYER_NAME', 'NAME', 'FULL_NAME') ?? '').trim();
    const teamId = Number(getVal(row, 'TEAM_ID') ?? 0) || 0;
    const points = Number(getVal(row, 'PTS', 'POINTS') ?? 0) || 0;
    const rebounds = Number(getVal(row, 'REB', 'TOT_REB', 'REBOUNDS', 'REBOUNDS_TOTAL') ?? 0) || 0;
    const assists = Number(getVal(row, 'AST', 'ASSISTS') ?? 0) || 0;
    return { personId, playerName, teamId, points, rebounds, assists };
  };

  const allRows: Array<Array<string | number>> =
    playerSets.length > 1
      ? playerSets.flatMap((rs) => (rs.rowSet ?? []) as Array<Array<string | number>>)
      : (playerSet.rowSet ?? []) as Array<Array<string | number>>;

  const rows = allRows
    .map(parseRow)
    .filter((r) => r.playerName && r.teamId && (r.points > 0 || r.rebounds > 0 || r.assists > 0));

  const homeRows = rows.filter((r) => r.teamId === homeTeamId);
  const awayRows = rows.filter((r) => r.teamId === awayTeamId);

  const topN = (arr: typeof rows, key: 'points' | 'rebounds' | 'assists', n: number) =>
    [...arr]
      .sort((a, b) => b[key] - a[key])
      .slice(0, n)
      .map((p) => ({ playerName: p.playerName, personId: p.personId, value: p[key] }));

  const homeTopPts = topN(homeRows, 'points', 3);
  const homeTopReb = topN(homeRows, 'rebounds', 3);
  const homeTopAst = topN(homeRows, 'assists', 3);
  const awayTopPts = topN(awayRows, 'points', 3);
  const awayTopReb = topN(awayRows, 'rebounds', 3);
  const awayTopAst = topN(awayRows, 'assists', 3);

  const gameHighPts = rows.length ? [...rows].sort((a, b) => b.points - a.points)[0] : null;
  const gameHighReb = rows.length ? [...rows].sort((a, b) => b.rebounds - a.rebounds)[0] : null;
  const gameHighAst = rows.length ? [...rows].sort((a, b) => b.assists - a.assists)[0] : null;

  const result: LastH2HBoxScore = {
    gameId,
    homeTeamId,
    awayTeamId,
    homeTopPts,
    homeTopReb,
    homeTopAst,
    awayTopPts,
    awayTopReb,
    awayTopAst,
    gameHighPtsPersonId: gameHighPts?.personId ?? null,
    gameHighRebPersonId: gameHighReb?.personId ?? null,
    gameHighAstPersonId: gameHighAst?.personId ?? null,
  };
  await setCached(cacheKey, result, CACHE_TTL.SCOREBOARD);
  return result;
}
