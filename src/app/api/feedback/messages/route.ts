import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = apiLimiter(user.user_id);
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const companyId = user.role === 'ADM'
    ? new URL(request.url).searchParams.get('company_id') ?? user.company_id
    : user.company_id;

  const channel = await prisma.companyFeedbackChannel.findUnique({
    where: { company_id: companyId },
    select: { id: true },
  });

  if (!channel) return NextResponse.json({ data: [], total: 0 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const unreadOnly = searchParams.get('unread') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit_ = Math.min(50, parseInt(searchParams.get('limit') ?? '20'));
  const offset = (page - 1) * limit_;

  const where = {
    channel_id: channel.id,
    ...(type ? { type } : {}),
    ...(unreadOnly ? { read: false } : {}),
  };

  const [feedbacks, total] = await Promise.all([
    prisma.anonymousFeedback.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit_,
      select: {
        id: true, type: true, category: true,
        message: true, read: true, created_at: true,
      },
    }),
    prisma.anonymousFeedback.count({ where }),
  ]);

  return NextResponse.json({ data: feedbacks, total, page, limit: limit_ });
}

// PATCH — mark as read
export async function PATCH(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { feedback_id, read } = body;

  // Verify ownership before marking as read
  const feedback = await prisma.anonymousFeedback.findUnique({
    where: { id: feedback_id },
    include: { channel: { select: { company_id: true } } },
  });

  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role !== 'ADM' && feedback.channel.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.anonymousFeedback.update({
    where: { id: feedback_id },
    data: { read: read ?? true },
  });

  return NextResponse.json({ success: true });
}
