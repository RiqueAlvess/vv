import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    message: z.string().min(1).optional(),
    starts_at: z.string().optional(),
    ends_at: z.string().optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (d) =>
      !d.starts_at || !d.ends_at || new Date(d.ends_at) > new Date(d.starts_at),
    {
      message: 'Data de fim deve ser posterior à data de início',
      path: ['ends_at'],
    }
  );

export async function PATCH(request: Request, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const existing = await prisma.systemNotification.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Notificação não encontrada' },
        { status: 404 }
      );
    }

    const { starts_at, ends_at, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (starts_at) updateData.starts_at = new Date(starts_at);
    if (ends_at) updateData.ends_at = new Date(ends_at);

    const notification = await prisma.systemNotification.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(notification);
  } catch (err) {
    console.error('Update notification error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

    const { id } = await params;

    const existing = await prisma.systemNotification.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Notificação não encontrada' },
        { status: 404 }
      );
    }

    await prisma.systemNotification.delete({ where: { id } });

    return NextResponse.json({ message: 'Notificação removida com sucesso' });
  } catch (err) {
    console.error('Delete notification error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
