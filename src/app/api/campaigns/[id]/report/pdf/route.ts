import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { PGRReportDocument } from '@/lib/pdf/pgr-report';
import { HSE_DIMENSIONS, RISK_THRESHOLDS_NEGATIVE, RISK_THRESHOLDS_POSITIVE, NR_MATRIX } from '@/lib/constants';
import type { RiskLevel } from '@/types';

interface RouteParams { params: Promise<{ id: string }> }

function getRiskLevel(score: number, type: 'positive' | 'negative'): RiskLevel {
  if (type === 'negative') {
    for (const t of RISK_THRESHOLDS_NEGATIVE) { if (score >= t.min) return t.level; }
    return 'aceitavel';
  }
  for (const t of RISK_THRESHOLDS_POSITIVE) { if (score <= t.max) return t.level; }
  return 'aceitavel';
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { company: { select: { name: true, cnpj: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (campaign.status !== 'closed') {
      return NextResponse.json({ error: 'Relatorio disponivel apenas para campanhas encerradas' }, { status: 400 });
    }
    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all responses and calculate aggregate dimension scores
    const allResponses = await prisma.surveyResponse.findMany({
      where: { campaign_id: id },
      select: { responses: true },
    });

    if (!allResponses.length) return NextResponse.json({ error: 'Sem respostas' }, { status: 404 });

    // Calculate campaign-wide dimension scores (Blind-Drop: cannot link to specific positions)
    const campaignDimScores: Record<string, { score: number; risk: RiskLevel; nr: number }> = {};
    for (const dim of HSE_DIMENSIONS) {
      let total = 0;
      let count = 0;
      for (const resp of allResponses) {
        const answers = resp.responses as Record<string, number>;
        for (const qn of dim.questionNumbers) {
          const val = answers[`q${qn}`];
          if (val !== undefined) { total += val; count++; }
        }
      }
      const avg = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
      const risk = getRiskLevel(avg, dim.type);
      campaignDimScores[dim.key] = {
        score: avg,
        risk,
        nr: NR_MATRIX[risk].probability * NR_MATRIX.default_severity,
      };
    }

    // Fetch hierarchy
    const units = await prisma.campaignUnit.findMany({
      where: { campaign_id: id },
      include: { sectors: { include: { positions: true } } },
      orderBy: { name: 'asc' },
    });

    const unitReports = units.map(unit => ({
      name: unit.name,
      sectors: unit.sectors.map(sector => ({
        name: sector.name,
        positions: sector.positions.map(position => ({
          name: position.name,
          // Same scores for all positions — anonymity requirement (Blind-Drop architecture)
          dimensions: campaignDimScores,
        })),
      })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf = await renderToBuffer(createElement(PGRReportDocument, {
      companyName: campaign.company.name,
      cnpj: campaign.company.cnpj,
      campaignName: campaign.name,
      startDate: new Date(campaign.start_date).toLocaleDateString('pt-BR'),
      endDate: new Date(campaign.end_date).toLocaleDateString('pt-BR'),
      generatedAt: new Date().toLocaleString('pt-BR'),
      totalRespondents: allResponses.length,
      units: unitReports,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const body = new Uint8Array(pdf);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PGR_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': body.length.toString(),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}
