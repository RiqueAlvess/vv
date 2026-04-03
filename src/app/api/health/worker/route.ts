import { NextResponse } from 'next/server';

// Worker health check — background worker removed in QR code model.
export async function GET() {
  return NextResponse.json({ status: 'ok', workers: 0, note: 'No background workers in QR code model' });
}
