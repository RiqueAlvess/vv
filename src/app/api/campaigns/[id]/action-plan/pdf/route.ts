import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { renderToBuffer } from '@react-pdf/renderer';
import { ActionPlanPDFDocument } from '@/lib/pdf/action-plan-report';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ActionPlanProblem } from '@/lib/hse-agent';
import React from 'react';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, company_id: true, name: true, company: { select: { name: true } } },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (user.role === 'RH' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const plan = await prisma.actionPlan.findUnique({ where: { campaign_id: id } });
  if (!plan) return NextResponse.json({ error: 'Plano de ação não encontrado' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const dimensionKey = searchParams.get('dimension') ?? undefined;

  const problems = plan.problems as unknown as ActionPlanProblem[];
  const generatedAt = format(plan.generated_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // Compute IGRP from problems NR values for the summary KPIs
  const igrp = problems.length > 0
    ? Number((problems.reduce((s, p) => s + p.nr, 0) / problems.length).toFixed(1))
    : 0;
  const igrpLabels: Record<number, string> = {};
  const igrpLabel =
    igrp >= 13 ? 'Crítico' :
    igrp >= 9  ? 'Importante' :
    igrp >= 5  ? 'Moderado' : 'Aceitável';

  void igrpLabels;

  const buffer = await renderToBuffer(
    React.createElement(ActionPlanPDFDocument, {
      companyName:       campaign.company.name,
      campaignName:      campaign.name,
      generatedAt,
      problems,
      filterDimensionKey: dimensionKey,
      igrp,
      igrpLabel,
    }) as unknown as Parameters<typeof renderToBuffer>[0],
  );

  const dimSuffix = dimensionKey ? `_${dimensionKey}` : '';
  const filename = `plano-acao${dimSuffix}_${id.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
