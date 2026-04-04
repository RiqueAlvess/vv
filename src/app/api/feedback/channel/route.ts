import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// GET — fetch channel info for the authenticated user's company
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const companyId = user.role === 'ADM'
    ? new URL(request.url).searchParams.get('company_id') ?? user.company_id
    : user.company_id;

  let channel = await prisma.companyFeedbackChannel.findUnique({
    where: { company_id: companyId },
    select: { id: true, public_token: true, active: true, created_at: true },
  });

  // Auto-create channel if it doesn't exist
  if (!channel) {
    const token = randomBytes(16).toString('hex'); // 32-char URL-safe token
    channel = await prisma.companyFeedbackChannel.create({
      data: { company_id: companyId, public_token: token },
      select: { id: true, public_token: true, active: true, created_at: true },
    });
  }

  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (forwardedHost
      ? `${forwardedProto ?? requestUrl.protocol.replace(':', '')}://${forwardedHost}`
      : `${requestUrl.protocol}//${host ?? requestUrl.host}`);
  const unreadCount = await prisma.anonymousFeedback.count({
    where: { channel_id: channel.id, read: false },
  });

  return NextResponse.json({
    ...channel,
    public_url: `${baseUrl}/feedback/${channel.public_token}`,
    unread_count: unreadCount,
  });
}
