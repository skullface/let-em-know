import { Redis } from '@upstash/redis';

// Initialize Redis client
// In production, these should come from environment variables
let redis: Redis | null = null;

/**
 * During `next build` we skip Redis so the page can be statically generated
 * (Upstash uses fetch internally, which Next treats as dynamic and would block static).
 * At runtime (revalidation or API routes) Redis is used as normal.
 */
function isStaticBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export function getRedis(): Redis | null {
  if (isStaticBuild()) return null;
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return null;
    }
    redis = new Redis({ url, token });
  }
  return redis;
}

const CACHE_TTL = {
  SCHEDULE: 6 * 60 * 60, // 6 hours
  STANDINGS: 6 * 60 * 60, // 6 hours
  INJURIES_NON_GAME_DAY: 6 * 60 * 60, // 6 hours
  INJURIES_GAME_DAY: 30 * 60, // 30 minutes (before 1pm ET on game day)
  INJURIES_GAME_DAY_AFTER_1PM: 10 * 60, // 10 minutes (after 1pm ET on game day - newest PDF)
  OPPONENT_GAMES: 6 * 60 * 60, // 6 hours
  HEAD_TO_HEAD: 6 * 60 * 60, // 6 hours
  SCOREBOARD: 2 * 60, // 2 minutes
  LINEUPS: 15 * 60, // 15 minutes
  ROSTER: 6 * 60 * 60, // 6 hours
};

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;
    const data = await client.get<T>(key);
    return data;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    await client.del(key);
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
  }
}

export const CacheKeys = {
  schedule: 'nba:schedule',
  standings: 'nba:standings',
  nextGame: 'cavs:next-game',
  /** Stale copy of next-game (long TTL); returned when NBA returns 429 to avoid failing the page. */
  nextGameStale: 'cavs:next-game:stale',
  injuries: (teamId: number, date: string) => `nba:injuries:${teamId}:${date}`,
  opponentGames: (teamId: number) => `nba:opponent-games:${teamId}`,
  headToHead: (teamId1: number, teamId2: number) =>
    `nba:h2h:${teamId1}:${teamId2}`,
  scoreboard: (date: string) => `nba:scoreboard:${date}`,
  lineups: (gameId: string) => `nba:lineups:${gameId}`,
  roster: (teamId: number) => `nba:roster:${teamId}`,
  recentStarters: (teamId: number) => `nba:recent-starters:${teamId}`,
};

export { CACHE_TTL };
