import { NextResponse } from 'next/server';
import { deleteCached, CacheKeys } from '@/lib/cache';
import { fetchSchedule } from '@/lib/nba/schedule';
import { fetchStandings } from '@/lib/nba/standings';
import { getNextGameData } from '@/lib/next-game';

// This endpoint should be called by a cron job (Vercel Cron or external service).
// It refreshes cached data and re-warms the next-game cache so user requests are
// served from cache and never trigger PDF parsing (which fails on Vercel serverless).

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = userAgent === 'vercel-cron/1.0';
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const hour = now.getHours();

    if (hour % 6 === 0) {
      await Promise.all([
        deleteCached(CacheKeys.schedule),
        deleteCached(CacheKeys.standings),
        deleteCached(CacheKeys.nextGame),
      ]);

      // Warm schedule and standings
      await Promise.all([fetchSchedule(), fetchStandings()]);

      // Warm next-game cache so the next user request is a cache HIT and never
      // runs the PDF injury path (avoids @napi-rs/canvas errors on serverless).
      try {
        await getNextGameData();
      } catch (e) {
        console.warn('[cron] getNextGameData failed (next request may refetch):', e);
      }
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString() });
  } catch (error) {
    console.error('Error in cron refresh:', error);
    return NextResponse.json(
      { error: 'Failed to refresh cache' },
      { status: 500 }
    );
  }
}
