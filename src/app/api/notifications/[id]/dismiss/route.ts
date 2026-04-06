import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Idempotent upsert — safe to call multiple times
    await prisma.systemNotificationView.upsert({
      where: {
        notification_id_user_id: {
          notification_id: id,
          user_id: user.user_id,
        },
      },
      update: {},
      create: {
        notification_id: id,
        user_id: user.user_id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Dismiss notification error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
