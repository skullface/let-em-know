import { NextResponse } from 'next/server';
import { deleteCached, CacheKeys, getRedis } from '@/lib/cache';

const CACHE_CLEAR_SECRET = process.env.CACHE_CLEAR_SECRET;

/**
 * Clear Next Ball cache keys so the next request refetches fresh data.
 *
 * Requires ?secret=<CACHE_CLEAR_SECRET> (env var). Optional: ?all=1 to clear all keys.
 *
 * Example: GET /api/cache/clear?secret=your-secret&all=1
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const clearAll = searchParams.get('all') === '1';

  if (!CACHE_CLEAR_SECRET || secret !== CACHE_CLEAR_SECRET) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const client = getRedis();
  if (!client) {
    return NextResponse.json(
      { ok: false, message: 'Redis not configured; nothing to clear.' },
      { status: 200 }
    );
  }

  try {
    if (clearAll) {
      // Delete all keys matching our prefixes
      const [scheduleKeys, standingsKeys, nextGameKeys, otherKeys] = await Promise.all([
        client.keys('nba:schedule*'),
        client.keys('nba:standings*'),
        client.keys('cavs:*'),
        client.keys('nba:*'),
      ]);
      const allKeys = [...new Set([...scheduleKeys, ...standingsKeys, ...nextGameKeys, ...otherKeys])];
      if (allKeys.length > 0) {
        await client.del(...allKeys);
      }
      return NextResponse.json({ ok: true, cleared: allKeys.length, keys: allKeys });
    }

    // Clear main keys and injury caches so next load gets fresh injuries too
    await Promise.all([
      deleteCached(CacheKeys.schedule),
      deleteCached(CacheKeys.standings),
      deleteCached(CacheKeys.nextGame),
    ]);
    const injuryKeys = await client.keys('nba:injuries*');
    if (injuryKeys.length > 0) {
      await client.del(...injuryKeys);
    }

    return NextResponse.json({
      ok: true,
      cleared: ['schedule', 'standings', 'next-game', ...(injuryKeys.length > 0 ? [`injuries (${injuryKeys.length} keys)`] : [])],
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
