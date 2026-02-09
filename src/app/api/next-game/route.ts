import { NextResponse } from 'next/server';
import { fetchSchedule, findNextCavaliersGame, getOpponent, isHomeGame, getAllBroadcasts, getStandingsFromSchedule, getHeadToHeadFromSchedule, getOpponentRecentGamesFromSchedule } from '@/lib/nba/schedule';
import { fetchStandings, findTeamStandings } from '@/lib/nba/standings';
import { fetchInjuryReport } from '@/lib/nba/injuries';
import { fetchTeamGameLog, fetchHeadToHeadGames, getBoxScoreTopPerformers, fetchTeamRoster } from '@/lib/nba/gamelog';
import { fetchProjectedLineup } from '@/lib/nba/lineups';
import { getCached, CacheKeys } from '@/lib/cache';
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

const DEBUG = process.env.NODE_ENV === 'development';

export async function GET() {
  try {
    // Check cache first (skipped if Redis not configured)
    const cached = await getCached<NextGameResponse>(CacheKeys.nextGame);
    if (cached) {
      if (DEBUG) console.log('[next-game] cache HIT, returning cached response');
      return NextResponse.json(cached);
    }
    if (DEBUG) console.log('[next-game] cache MISS, fetching fresh data');

    // Fetch schedule and find next game
    const schedule = await fetchSchedule();
    const nextGame = findNextCavaliersGame(schedule);

    if (!nextGame) {
      return NextResponse.json(
        { error: 'No upcoming game found' },
        { status: 404 }
      );
    }

    const opponent = getOpponent(nextGame);
    const isHome = isHomeGame(nextGame);
    const gameDate = new Date(nextGame.gameDateTimeEst);
    const isGameDay = isSameDay(gameDate, new Date());
    // Injury PDFs are published by calendar day (today); use today in ET so we get the latest report
    const injuryReportDate = getTodayInEt();

    // Cavaliers and opponent recent games: use schedule (correct dates + both scores); fallback to API only if schedule has none
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

    // Fetch remaining data in parallel
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
        opponentRecentGames: `${opponentRecentGames.length} games (${usedScheduleForRecent ? 'schedule' : 'gamelog fallback'})`,
      });
    }

    const standings =
      standingsResult.status === 'fulfilled' ? standingsResult.value : null;
    const cavaliersInjuries =
      cavaliersInjuriesResult.status === 'fulfilled'
        ? cavaliersInjuriesResult.value
        : [];
    const opponentInjuries =
      opponentInjuriesResult.status === 'fulfilled'
        ? opponentInjuriesResult.value
        : [];

    const [cavsRoster, oppRoster] = await Promise.all([
      fetchTeamRoster(CAVALIERS_TEAM_ID),
      fetchTeamRoster(opponent.teamId),
    ]);
    const enrichInjuriesWithJersey = (injuries: InjuryEntry[], roster: Player[]): InjuryEntry[] => {
      const byName = new Map<string, Player>();
      for (const p of roster) {
        if (!p.firstName && !p.lastName) continue;
        const full = `${(p.firstName ?? '').trim()} ${(p.lastName ?? '').trim()}`.trim().toLowerCase();
        byName.set(full, p);
        const lastFirst = `${(p.lastName ?? '').trim()}, ${(p.firstName ?? '').trim()}`.trim().toLowerCase();
        if (lastFirst !== full) byName.set(lastFirst, p);
      }
      return injuries.map((inj) => {
        const key = inj.playerName.trim().toLowerCase();
        let player = byName.get(key);
        if (!player && key.includes(',')) {
          const [last, first] = key.split(',').map((s) => s.trim());
          player = byName.get(`${first} ${last}`);
        }
        if (!player) {
          const lastWord = key.split(/\s+/).pop();
          if (lastWord) player = roster.find((p) => (p.lastName ?? '').toLowerCase() === lastWord);
        }
        const jerseyNumber = player?.jerseyNumber;
        return jerseyNumber ? { ...inj, jerseyNumber } : inj;
      });
    };
    const cavaliersInjuriesEnriched = enrichInjuriesWithJersey(cavaliersInjuries, cavsRoster);
    const opponentInjuriesEnriched = enrichInjuriesWithJersey(opponentInjuries, oppRoster);

    let headToHead = getHeadToHeadFromSchedule(schedule, opponent.teamId);
    if (DEBUG) console.log('[next-game] headToHead from schedule:', headToHead.length, 'games');
    if (headToHead.length === 0) {
      try {
        const apiH2H = await fetchHeadToHeadGames(CAVALIERS_TEAM_ID, opponent.teamId);
        headToHead = apiH2H
          .filter((g) => g.gameId && g.gameId.length >= 10 && /^\d+$/.test(g.gameId))
          .map((g) => ({
            ...g,
            homeTeam: {
              ...g.homeTeam,
              teamTricode: g.homeTeam.teamId === CAVALIERS_TEAM_ID ? 'CLE' : (g.homeTeam.teamTricode || opponent.teamTricode || '—'),
            },
            awayTeam: {
              ...g.awayTeam,
              teamTricode: g.awayTeam.teamId === CAVALIERS_TEAM_ID ? 'CLE' : (g.awayTeam.teamTricode || opponent.teamTricode || '—'),
            },
          }));
      } catch (e) {
        if (DEBUG) console.warn('[next-game] Head-to-head API fallback failed:', e);
      }
    }
    if (DEBUG) console.log('[next-game] headToHead final count:', headToHead.length);
    headToHead = addResultToGames(headToHead, CAVALIERS_TEAM_ID);

    let lastHeadToHeadBoxScore: NextGameResponse['lastHeadToHeadBoxScore'] = null;
    const mostRecentH2H = headToHead[0];
    if (mostRecentH2H?.gameId && mostRecentH2H?.homeTeam?.teamId != null && mostRecentH2H?.awayTeam?.teamId != null) {
      try {
        lastHeadToHeadBoxScore = await getBoxScoreTopPerformers(
          mostRecentH2H.gameId,
          mostRecentH2H.homeTeam.teamId,
          mostRecentH2H.awayTeam.teamId
        );
      } catch (e) {
        if (DEBUG) console.warn('[next-game] lastHeadToHeadBoxScore failed:', e);
      }
    }

    if (standingsResult.status === 'rejected') {
      console.error('Failed to fetch standings:', standingsResult.reason);
    }
    if (cavaliersInjuriesResult.status === 'rejected') {
      console.error('Failed to fetch Cavaliers injuries:', cavaliersInjuriesResult.reason);
    }
    if (opponentInjuriesResult.status === 'rejected') {
      console.error('Failed to fetch opponent injuries:', opponentInjuriesResult.reason);
    }

    // Use schedule-derived standings when API returns empty (e.g. stats.nba.com blocks or different structure)
    let standingsToUse = standings?.length ? standings : getStandingsFromSchedule(schedule);
    let cavaliersStandings = findTeamStandings(standingsToUse, CAVALIERS_TEAM_ID);
    let opponentStandings = findTeamStandings(standingsToUse, opponent.teamId);
    if (!cavaliersStandings) {
      console.warn('Cavaliers standings not found, using placeholder');
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
      console.warn('Opponent standings not found, using placeholder');
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

    // Fetch projected lineups (optional; often empty until game starts)
    const [cavLineupResult, oppLineupResult] = await Promise.allSettled([
      fetchProjectedLineup(nextGame.gameId, CAVALIERS_TEAM_ID, cavaliersInjuriesEnriched),
      fetchProjectedLineup(nextGame.gameId, opponent.teamId, opponentInjuriesEnriched),
    ]);
    const cavaliersLineup = cavLineupResult.status === 'fulfilled' ? cavLineupResult.value : [];
    const opponentLineup = oppLineupResult.status === 'fulfilled' ? oppLineupResult.value : [];

    // Build response
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
      standings: {
        cavaliers: cavaliersStandings,
        opponent: opponentStandings,
      },
      injuries: {
        cavaliers: cavaliersInjuriesEnriched,
        opponent: opponentInjuriesEnriched,
      },
      projectedLineups: {
        cavaliers: cavaliersLineup,
        opponent: opponentLineup,
      },
      cavaliersRecentGames: cavaliersRecentGames.slice(0, 3),
      opponentRecentGames: opponentRecentGames.slice(0, 3),
      headToHead,
      lastHeadToHeadBoxScore,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the response (TTL based on game day status)
    const { setCached, CACHE_TTL } = await import('@/lib/cache');
    const ttl = isGameDay ? CACHE_TTL.INJURIES_GAME_DAY : CACHE_TTL.SCHEDULE;
    await setCached(CacheKeys.nextGame, response, ttl);

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Error fetching next game:', message, stack ?? '');
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: 'Failed to fetch next game data',
        ...(isDev && { detail: message, stack }),
      },
      { status: 500 }
    );
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/** Today's date in Eastern time (for injury report PDF date matching). */
function getTodayInEt(): Date {
  const et = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const [datePart] = et.split(',');
  const [month, day, year] = datePart.trim().split('/').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}
