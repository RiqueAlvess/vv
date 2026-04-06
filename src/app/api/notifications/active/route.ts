import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    const notification = await prisma.systemNotification.findFirst({
      where: {
        active: true,
        starts_at: { lte: now },
        ends_at: { gte: now },
        views: {
          none: { user_id: user.user_id },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ notification: notification ?? null });
  } catch (err) {
    console.error('Get active notification error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
