import { NextResponse } from 'next/server';
import { deleteCached, CacheKeys, getRedis } from '@/lib/cache';

/**
 * Clear Next Ball cache keys so the next request refetches fresh data.
 *
 * Usage:
 *   - Browser or curl: GET http://localhost:3000/api/cache/clear
 *   - Optional: ?all=1 to clear all keys matching nba:* and cavs:* (slower)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clearAll = searchParams.get('all') === '1';

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

    // Clear only the main keys used for the next-game response
    await Promise.all([
      deleteCached(CacheKeys.schedule),
      deleteCached(CacheKeys.standings),
      deleteCached(CacheKeys.nextGame),
    ]);

    return NextResponse.json({
      ok: true,
      cleared: ['schedule', 'standings', 'next-game'],
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
