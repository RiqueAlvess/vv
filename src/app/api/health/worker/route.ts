import { NextResponse } from 'next/server';
import { statusUpdateQueue } from '@/lib/queue';

export async function GET() {
  try {
    const workers = await statusUpdateQueue.getWorkers();
    const count = workers.length;

    if (count > 0) {
      return NextResponse.json({ status: 'ok', workers: count });
    }

    return NextResponse.json({ status: 'degraded', workers: 0 }, { status: 503 });
  } catch {
    return NextResponse.json({ status: 'degraded', workers: 0 }, { status: 503 });
  }
}
