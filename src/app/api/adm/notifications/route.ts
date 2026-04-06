import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const notificationSchema = z
  .object({
    title: z.string().min(1, 'Título obrigatório').max(200),
    message: z.string().min(1, 'Mensagem obrigatória'),
    starts_at: z.string().min(1, 'Data de início obrigatória'),
    ends_at: z.string().min(1, 'Data de fim obrigatória'),
    active: z.boolean().optional().default(true),
  })
  .refine((d) => new Date(d.ends_at) > new Date(d.starts_at), {
    message: 'Data de fim deve ser posterior à data de início',
    path: ['ends_at'],
  });

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429 }
      );
    }

    const notifications = await prisma.systemNotification.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { views: true } },
        creator: { select: { name: true } },
      },
    });

    const now = new Date();
    const data = notifications.map(({ _count, ...n }) => ({
      ...n,
      view_count: _count.views,
      status:
        !n.active || n.ends_at < now
          ? 'expired'
          : n.starts_at > now
          ? 'scheduled'
          : 'active',
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error('List notifications error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = notificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, message, starts_at, ends_at, active } = parsed.data;

    const notification = await prisma.systemNotification.create({
      data: {
        title,
        message,
        starts_at: new Date(starts_at),
        ends_at: new Date(ends_at),
        active: active ?? true,
        created_by: user.user_id,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (err) {
    console.error('Create notification error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
