import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { enqueueJob } from '@/lib/jobs';
import { buildDashboardXlsxArtifact } from '@/services/report-export.service';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM') return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (campaign.status !== 'closed') {
    return NextResponse.json({ error: 'Exportação disponível apenas para campanhas encerradas' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const sync = searchParams.get('sync') === '1';

  if (sync) {
    const artifact = await buildDashboardXlsxArtifact(id);
    return new NextResponse(Buffer.from(artifact.base64, 'base64'), {
      status: 200,
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
      },
    });
  }

  const jobId = await enqueueJob('generate_dashboard_xlsx', {
    campaign_id: id,
    requester_user_id: user.user_id,
  });

  return NextResponse.json(
    {
      success: true,
      job_id: jobId,
      message: 'Exportação enfileirada. Consulte /api/jobs/{job_id} e /api/jobs/{job_id}/download',
    },
    { status: 202 },
  );
}
