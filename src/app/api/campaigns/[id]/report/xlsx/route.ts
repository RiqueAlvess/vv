import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPgrXlsxArtifact } from '@/services/report-export.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = params.id;

  if (user.role === 'RH') {
    return NextResponse.json({ error: 'Acesso restrito a MEDICO e ADM' }, { status: 403 });
  }

  if (user.role !== 'ADM') {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { company_id: true },
    });
    if (!campaign || campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const artifact = await buildPgrXlsxArtifact(campaignId);
    const buf = Buffer.from(artifact.base64, 'base64');
    return new Response(buf, {
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
        'Content-Length': buf.length.toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar relatório';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
