import { NextResponse } from 'next/server';

// This endpoint has been replaced by the QR code system.
// Use /api/campaigns/[id]/qrcode instead.
export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint has been replaced. Use /api/campaigns/[id]/qrcode' },
    { status: 410 }
  );
}
