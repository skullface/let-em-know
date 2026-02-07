import { NextResponse } from 'next/server';
import { deleteCached, CacheKeys } from '@/lib/cache';
import { fetchSchedule } from '@/lib/nba/schedule';
import { fetchStandings } from '@/lib/nba/standings';

// This endpoint should be called by a cron job (Vercel Cron or external service)
// It refreshes cached data according to the refresh strategy

export async function GET(request: Request) {
  // Verify the request is from a cron job (check for authorization header or secret)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const hour = now.getHours();

    // Refresh schedule and standings every 6 hours
    if (hour % 6 === 0) {
      await Promise.all([
        deleteCached(CacheKeys.schedule),
        deleteCached(CacheKeys.standings),
        deleteCached(CacheKeys.nextGame), // Force refresh of next game
      ]);

      // Pre-fetch to warm cache
      await Promise.all([fetchSchedule(), fetchStandings()]);
    }

    // Refresh injury reports more frequently on game days
    // This would need to check if today is a game day
    // For now, we'll refresh injuries every 6 hours (non-game day) or 30 min (game day)
    // The actual refresh logic is handled in the next-game endpoint

    return NextResponse.json({ success: true, timestamp: now.toISOString() });
  } catch (error) {
    console.error('Error in cron refresh:', error);
    return NextResponse.json(
      { error: 'Failed to refresh cache' },
      { status: 500 }
    );
  }
}
