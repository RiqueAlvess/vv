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
      select: { id: true, company_id: true, status: true },
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

    const totalResponded = await prisma.surveyResponse.count({
      where: { campaign_id: id },
    });

    return NextResponse.json({
      campaign_id: id,
      status: campaign.status,
      total_responded: totalResponded,
      response_rate: 0, // No fixed pool of invited users in QR code model
    });
  } catch (err) {
    console.error('Metrics error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
