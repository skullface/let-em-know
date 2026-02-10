import { NextResponse } from 'next/server';
import { getNextGameData } from '@/lib/next-game';

export async function GET() {
  try {
    const data = await getNextGameData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Error fetching next game:', message, stack ?? '');

    if (message === 'No upcoming game found') {
      return NextResponse.json(
        { error: 'No upcoming game found' },
        { status: 404 }
      );
    }

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
