import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { enqueueJob } from '@/lib/jobs';
import { log } from '@/lib/logger';

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

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429 }
      );
    }

    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
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

    if (campaign.status !== 'active') {
      return NextResponse.json(
        { error: 'Só é possível encerrar campanhas ativas' },
        { status: 400 }
      );
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'closed',
        updated_at: new Date(),
      },
    });

    log('AUDIT', {
      action: 'campaign.close',
      message: `Campanha encerrada: ${campaign.name}`,
      user_id: user.user_id,
      user_email: user.email,
      company_id: campaign.company_id,
      target_id: id,
      target_type: 'campaign',
    });

    try {
      const jobId = await enqueueJob('calculate_campaign_metrics', { campaign_id: id });
      console.log(`[Close] Metrics job enqueued for campaign ${id}: ${jobId}`);
    } catch (metricsErr) {
      console.error(`[Close] Metrics enqueue failed (non-fatal):`, metricsErr);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Close campaign error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
