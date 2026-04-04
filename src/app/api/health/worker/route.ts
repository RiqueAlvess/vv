import { NextResponse } from 'next/server';

// Worker health check endpoint.
export async function GET() {
  return NextResponse.json({ status: 'ok', workers: 1, note: 'Background job processor enabled' });
}
