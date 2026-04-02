import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const limit = apiLimiter(ip);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em breve.' },
        { status: 429 }
      );
    }

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, company_id: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit_ = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit_;

    const where = { campaign_id: id };

    const [count, invitations, respondedCount] = await Promise.all([
      prisma.surveyInvitation.count({ where }),
      prisma.surveyInvitation.findMany({
        where,
        select: {
          id: true,
          campaign_id: true,
          employee_id: true,
          status: true,
          sent_at: true,
          expires_at: true,
        },
        orderBy: { sent_at: 'desc' },
        skip: offset,
        take: limit_,
      }),
      prisma.surveyInvitation.count({
        where: { campaign_id: id, token_used: true },
      }),
    ]);

    return NextResponse.json({
      data: invitations,
      aggregated: {
        total: count,
        responded: respondedCount,
      },
      pagination: {
        page,
        limit: limit_,
        total: count,
        totalPages: Math.ceil(count / limit_),
      },
    });
  } catch (err) {
    console.error('List invitations error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
