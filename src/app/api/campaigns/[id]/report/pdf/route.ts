import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { enqueueJob } from '@/lib/jobs';
import { buildCampaignPgrHtmlArtifact } from '@/services/report-export.service';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, company_id: true, status: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    if (campaign.status !== 'closed') {
      return NextResponse.json({ error: 'Relatório disponível apenas para campanhas encerradas' }, { status: 400 });
    }
    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sync = searchParams.get('sync') === '1';

    if (sync) {
      const artifact = await buildCampaignPgrHtmlArtifact(id);
      return new NextResponse(Buffer.from(artifact.base64, 'base64').toString('utf-8'), {
        status: 200,
        headers: {
          'Content-Type': artifact.contentType,
          'Content-Disposition': `inline; filename="${artifact.filename}"`,
        },
      });
    }

    const jobId = await enqueueJob('generate_campaign_pgr_html', {
      campaign_id: id,
      requester_user_id: user.user_id,
    });

    return NextResponse.json(
      {
        success: true,
        job_id: jobId,
        message: 'Relatório enfileirado. Consulte /api/jobs/{job_id} e /api/jobs/{job_id}/download',
      },
      { status: 202 },
    );
  } catch (err) {
    console.error('PGR report queue error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
