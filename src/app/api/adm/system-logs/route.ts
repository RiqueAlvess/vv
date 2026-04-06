import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level')?.trim() ?? '';
    const action = searchParams.get('action')?.trim() ?? '';
    const from = searchParams.get('from')?.trim() ?? '';
    const to = searchParams.get('to')?.trim() ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = (page - 1) * pageLimit;

    const where: Record<string, unknown> = {};

    if (level) where.level = level;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (from || to) {
      where.created_at = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageLimit,
      }),
      prisma.systemLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page });
  } catch (err) {
    console.error('List logs error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
