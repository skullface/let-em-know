/**
 * Shared next-game data fetcher. Used by the homepage (direct call) and by
 * /api/next-game (for native apps / external consumers). Single-flight ensures
 * concurrent requests in the same process don't all hit NBA APIs when cache is cold.
 */

import { fetchSchedule, findNextCavaliersGame, getOpponent, isHomeGame, getAllBroadcasts, getStandingsFromSchedule, getHeadToHeadFromSchedule, getOpponentRecentGamesFromSchedule } from '@/lib/nba/schedule';
import { fetchStandings, findTeamStandings } from '@/lib/nba/standings';
import { fetchInjuryReport } from '@/lib/nba/injuries';
import { normalizeNameForMatch } from '@/lib/nba/names';
import { fetchTeamGameLog, fetchHeadToHeadGames, getBoxScoreTopPerformers, fetchTeamRoster } from '@/lib/nba/gamelog';
import { getCached, setCached, CacheKeys, CACHE_TTL } from '@/lib/cache';
import { NextGameResponse, GameSummary, InjuryEntry, Player } from '@/lib/nba/types';

const CAVALIERS_TEAM_ID = 1610612739;

function addResultToGames(games: GameSummary[], focusTeamId: number): GameSummary[] {
  return games.map((g) => {
    const homeSc = g.homeScore;
    const awaySc = g.awayScore;
    if (typeof homeSc !== 'number' || typeof awaySc !== 'number') return g;
    const focusIsHome = g.homeTeam.teamId === focusTeamId;
    const focusScore = focusIsHome ? homeSc : awaySc;
    const otherScore = focusIsHome ? awaySc : homeSc;
    const result = focusScore > otherScore ? 'W' : focusScore < otherScore ? 'L' : undefined;
    return { ...g, result };
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getTodayInEt(): Date {
  const et = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const [datePart] = et.split(',');
  const [month, day, year] = datePart.trim().split('/').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

const DEBUG = process.env.NODE_ENV === 'development';

/** Max time to wait for fresh data before returning stale or failing. */
const FETCH_TIMEOUT_MS = 10_000;

/** In-flight promise so concurrent callers share one fetch when cache is cold (reduces NBA API rate limit hits). */
let nextGamePromise: Promise<NextGameResponse> | null = null;

/**
 * Fetches the next Cavaliers game and all related data. Uses Redis cache when available.
 * Throws if no upcoming game or on fetch error (e.g. NBA rate limit).
 * On timeout, returns stale cache if available, otherwise throws.
 */
export async function getNextGameData(): Promise<NextGameResponse> {
  const cached = await getCached<NextGameResponse>(CacheKeys.nextGame);
  if (cached) {
    if (DEBUG) console.log('[next-game] cache HIT');
    return cached;
  }

  if (nextGamePromise) {
    if (DEBUG) console.log('[next-game] single-flight: waiting on in-flight request');
    return nextGamePromise;
  }

  const doFetch = (async (): Promise<NextGameResponse> => {
    try {
      if (DEBUG) console.log('[next-game] cache MISS, fetching fresh data');

      const schedule = await fetchSchedule();
      const nextGame = findNextCavaliersGame(schedule);

      if (!nextGame) {
        throw new Error('No upcoming game found');
      }

      const opponent = getOpponent(nextGame);
      const isHome = isHomeGame(nextGame);
      const gameDate = new Date(nextGame.gameDateTimeEst);
      const isGameDay = isSameDay(gameDate, new Date());
      const injuryReportDate = getTodayInEt();

      let cavaliersRecentGames = getOpponentRecentGamesFromSchedule(schedule, CAVALIERS_TEAM_ID, 3);
      let opponentRecentGames = getOpponentRecentGamesFromSchedule(schedule, opponent.teamId, 3);
      const usedScheduleForRecent = opponentRecentGames.length > 0;
      if (!usedScheduleForRecent) {
        try {
          opponentRecentGames = (await fetchTeamGameLog(opponent.teamId)).slice(0, 3);
        } catch (e) {
          if (DEBUG) console.warn('[next-game] Opponent recent games fallback failed:', e);
        }
      }
      if (cavaliersRecentGames.length === 0) {
        try {
          cavaliersRecentGames = (await fetchTeamGameLog(CAVALIERS_TEAM_ID)).slice(0, 3);
        } catch (e) {
          if (DEBUG) console.warn('[next-game] Cavaliers recent games fallback failed:', e);
        }
      }
      cavaliersRecentGames = addResultToGames(cavaliersRecentGames, CAVALIERS_TEAM_ID);
      opponentRecentGames = addResultToGames(opponentRecentGames, opponent.teamId);

      const [
        standingsResult,
        cavaliersInjuriesResult,
        opponentInjuriesResult,
      ] = await Promise.allSettled([
        fetchStandings(),
        fetchInjuryReport(CAVALIERS_TEAM_ID, injuryReportDate, { isGameDay }),
        fetchInjuryReport(opponent.teamId, injuryReportDate, { isGameDay }),
      ]);

      if (DEBUG) {
        console.log('[next-game] fetch results:', {
          standings: standingsResult.status === 'fulfilled' ? `ok (${standingsResult.value?.length ?? 0} entries)` : `rejected: ${standingsResult.reason}`,
          cavaliersInjuries: cavaliersInjuriesResult.status === 'fulfilled' ? `ok (${cavaliersInjuriesResult.value?.length ?? 0})` : `rejected: ${cavaliersInjuriesResult.reason}`,
          opponentInjuries: opponentInjuriesResult.status === 'fulfilled' ? `ok (${opponentInjuriesResult.value?.length ?? 0})` : `rejected: ${opponentInjuriesResult.reason}`,
        });
      }

      const standings = standingsResult.status === 'fulfilled' ? standingsResult.value : null;
      const cavaliersInjuries = cavaliersInjuriesResult.status === 'fulfilled' ? cavaliersInjuriesResult.value : [];
      const opponentInjuries = opponentInjuriesResult.status === 'fulfilled' ? opponentInjuriesResult.value : [];

      const [cavsRoster, oppRoster] = await Promise.all([
        fetchTeamRoster(CAVALIERS_TEAM_ID),
        fetchTeamRoster(opponent.teamId),
      ]);

      const enrichInjuriesWithJersey = (injuries: InjuryEntry[], roster: Player[]): InjuryEntry[] => {
        const byNormalizedName = new Map<string, Player>();
        for (const p of roster) {
          if (!p.firstName && !p.lastName) continue;
          const full = `${(p.firstName ?? '').trim()} ${(p.lastName ?? '').trim()}`.trim();
          const key = normalizeNameForMatch(full);
          byNormalizedName.set(key, p);
          const lastFirst = `${(p.lastName ?? '').trim()}, ${(p.firstName ?? '').trim()}`.trim();
          const keyLastFirst = normalizeNameForMatch(lastFirst);
          if (keyLastFirst !== key) byNormalizedName.set(keyLastFirst, p);
        }
        return injuries.map((inj) => {
          const raw = inj.playerName.trim();
          const key = normalizeNameForMatch(raw);
          let player = byNormalizedName.get(key);
          if (!player && raw.includes(',')) {
            const [last, first] = raw.split(',').map((s) => s.trim());
            player = byNormalizedName.get(normalizeNameForMatch(`${first} ${last}`));
          }
          if (!player) {
            const lastWord = raw.split(/\s+/).pop();
            if (lastWord) {
              const normalizedLast = normalizeNameForMatch(lastWord);
              player = roster.find((p) => normalizeNameForMatch(p.lastName ?? '') === normalizedLast);
            }
          }
          if (!player) return inj;
          const displayName = `${(player.firstName ?? '').trim()} ${(player.lastName ?? '').trim()}`.trim() || inj.playerName;
          return {
            ...inj,
            playerName: displayName,
            ...(player.jerseyNumber != null && player.jerseyNumber !== '' ? { jerseyNumber: player.jerseyNumber } : {}),
          };
        });
      };
      const cavaliersInjuriesEnriched = enrichInjuriesWithJersey(cavaliersInjuries, cavsRoster);
      const opponentInjuriesEnriched = enrichInjuriesWithJersey(opponentInjuries, oppRoster);

      let headToHead = getHeadToHeadFromSchedule(schedule, opponent.teamId);
      if (headToHead.length === 0) {
        try {
          const apiH2H = await fetchHeadToHeadGames(CAVALIERS_TEAM_ID, opponent.teamId);
          headToHead = apiH2H
            .filter((g) => g.gameId && g.gameId.length >= 10 && /^\d+$/.test(g.gameId))
            .map((g) => ({
              ...g,
              homeTeam: { ...g.homeTeam, teamTricode: g.homeTeam.teamId === CAVALIERS_TEAM_ID ? 'CLE' : (g.homeTeam.teamTricode || opponent.teamTricode || '—') },
              awayTeam: { ...g.awayTeam, teamTricode: g.awayTeam.teamId === CAVALIERS_TEAM_ID ? 'CLE' : (g.awayTeam.teamTricode || opponent.teamTricode || '—') },
            }));
        } catch (e) {
          if (DEBUG) console.warn('[next-game] Head-to-head API fallback failed:', e);
        }
      }
      headToHead = addResultToGames(headToHead, CAVALIERS_TEAM_ID);

      let lastHeadToHeadBoxScore: NextGameResponse['lastHeadToHeadBoxScore'] = null;
      const mostRecentH2H = headToHead[0];
      if (mostRecentH2H?.gameId && mostRecentH2H?.homeTeam?.teamId != null && mostRecentH2H?.awayTeam?.teamId != null) {
        try {
          lastHeadToHeadBoxScore = await getBoxScoreTopPerformers(mostRecentH2H.gameId, mostRecentH2H.homeTeam.teamId, mostRecentH2H.awayTeam.teamId);
        } catch (e) {
          if (DEBUG) console.warn('[next-game] lastHeadToHeadBoxScore failed:', e);
        }
      }

      if (standingsResult.status === 'rejected') console.error('Failed to fetch standings:', standingsResult.reason);
      if (cavaliersInjuriesResult.status === 'rejected') console.error('Failed to fetch Cavaliers injuries:', cavaliersInjuriesResult.reason);
      if (opponentInjuriesResult.status === 'rejected') console.error('Failed to fetch opponent injuries:', opponentInjuriesResult.reason);

      let standingsToUse = standings?.length ? standings : getStandingsFromSchedule(schedule);
      let cavaliersStandings = findTeamStandings(standingsToUse, CAVALIERS_TEAM_ID);
      let opponentStandings = findTeamStandings(standingsToUse, opponent.teamId);
      if (!cavaliersStandings) {
        cavaliersStandings = {
          teamId: CAVALIERS_TEAM_ID,
          teamName: 'Cavaliers',
          teamCity: 'Cleveland',
          teamTricode: 'CLE',
          wins: 0,
          losses: 0,
          winPct: 0,
          conferenceRank: 0,
          divisionRank: 0,
          leagueRank: 0,
          conference: 'East',
          division: 'Central',
        };
      }
      if (!opponentStandings) {
        opponentStandings = {
          teamId: opponent.teamId,
          teamName: opponent.teamName,
          teamCity: opponent.teamCity,
          teamTricode: opponent.teamTricode,
          wins: 0,
          losses: 0,
          winPct: 0,
          conferenceRank: 0,
          divisionRank: 0,
          leagueRank: 0,
          conference: 'East',
          division: '',
        };
      }

      const response: NextGameResponse = {
        game: {
          gameId: nextGame.gameId,
          dateTime: nextGame.gameDateTimeUTC ?? nextGame.gameDateTimeEst,
          opponent: {
            teamId: opponent.teamId,
            teamName: opponent.teamName,
            teamCity: opponent.teamCity,
            teamTricode: opponent.teamTricode,
            teamSlug: opponent.teamSlug,
          },
          location: `${nextGame.arenaName}, ${nextGame.arenaCity}${nextGame.arenaState ? `, ${nextGame.arenaState}` : ''}`,
          isHome,
          broadcasts: getAllBroadcasts(nextGame),
        },
        standings: { cavaliers: cavaliersStandings, opponent: opponentStandings },
        injuries: { cavaliers: cavaliersInjuriesEnriched, opponent: opponentInjuriesEnriched },
        projectedLineups: { cavaliers: [], opponent: [] },
        cavaliersRecentGames: cavaliersRecentGames.slice(0, 3),
        opponentRecentGames: opponentRecentGames.slice(0, 3),
        headToHead,
        lastHeadToHeadBoxScore,
        lastUpdated: new Date().toISOString(),
      };

      const ttl = isGameDay ? CACHE_TTL.INJURIES_GAME_DAY : CACHE_TTL.SCHEDULE;
      await setCached(CacheKeys.nextGame, response, ttl);
      // Keep a long-lived stale copy so we can serve it when NBA returns 429
      await setCached(CacheKeys.nextGameStale, response, 24 * 60 * 60); // 24h

      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Too Many') || msg.includes('429')) {
        const stale = await getCached<NextGameResponse>(CacheKeys.nextGameStale);
        if (stale) {
          if (DEBUG) console.log('[next-game] NBA rate limited (429), returning stale cache');
          return stale;
        }
      }
      throw err;
    } finally {
      nextGamePromise = null;
    }
  })();

  const timeoutPromise = new Promise<NextGameResponse>((_, reject) => {
    setTimeout(() => reject(new Error('FETCH_TIMEOUT')), FETCH_TIMEOUT_MS);
  });

  nextGamePromise = (async (): Promise<NextGameResponse> => {
    try {
      return await Promise.race([doFetch, timeoutPromise]);
    } catch (e) {
      if (e instanceof Error && e.message === 'FETCH_TIMEOUT') {
        const stale = await getCached<NextGameResponse>(CacheKeys.nextGameStale);
        if (stale) {
          if (DEBUG) console.log('[next-game] Request timed out, returning stale cache');
          return stale;
        }
        throw new Error('Request timed out. Please try again in a moment.');
      }
      throw e;
    }
  })();

  return nextGamePromise;
}
