import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { generateActionPlan } from '@/lib/hse-agent';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from '@/services/score.service';
import type { DimensionType } from '@/types';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET — retrieve existing action plan
// ---------------------------------------------------------------------------

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, company_id: true, status: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const plan = await prisma.actionPlan.findUnique({ where: { campaign_id: id } });
  if (!plan) return NextResponse.json({ error: 'Plano de ação não gerado ainda' }, { status: 404 });

  return NextResponse.json(plan);
}

// ---------------------------------------------------------------------------
// POST — generate action plan via LLM and persist
// ---------------------------------------------------------------------------

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Apenas ADM ou RH podem gerar o plano de ação' }, { status: 403 });
  }

  const limit = apiLimiter(user.user_id);
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, company_id: true, name: true, status: true, company: { select: { name: true } } },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (campaign.status !== 'closed') {
    return NextResponse.json(
      { error: 'O plano de ação só pode ser gerado para campanhas encerradas' },
      { status: 400 },
    );
  }

  // Load dashboard metrics (use cached if available, otherwise compute on demand)
  const responses = await prisma.surveyResponse.findMany({
    where: { campaign_id: id },
    select: { responses: true },
  });

  const totalResponded = responses.length;
  if (totalResponded === 0) {
    return NextResponse.json({ error: 'Nenhuma resposta encontrada para gerar o plano' }, { status: 400 });
  }

  // Compute dimension averages
  const dimensions = HSE_DIMENSIONS.map((dim) => {
    let scoreSum = 0;
    let count = 0;
    for (const r of responses) {
      const score = ScoreService.calculateDimensionScore(
        (r.responses ?? {}) as Record<string, number>,
        dim.key as DimensionType,
      );
      if (Number.isFinite(score)) { scoreSum += score; count++; }
    }
    const avg_score = count > 0 ? Number((scoreSum / count).toFixed(2)) : 0;
    const risk_level = ScoreService.getRiskLevel(avg_score, dim.type);
    const nr = ScoreService.calculateNR(risk_level);
    const { label } = ScoreService.interpretNR(nr);

    return { key: dim.key, name: dim.name, type: dim.type, avg_score, risk_level, nr, nr_label: label };
  });

  const igrp = Number((dimensions.reduce((s, d) => s + d.nr, 0) / dimensions.length).toFixed(2));
  const { label: igrp_label } = ScoreService.interpretNR(igrp);

  // Call LLM
  let generated;
  try {
    generated = await generateActionPlan({
      campaign_name: campaign.name,
      company_name: campaign.company.name,
      total_responded: totalResponded,
      igrp,
      igrp_label,
      dimensions,
    });
  } catch (err) {
    console.error('HSE Agent LLM error:', err);
    return NextResponse.json(
      { error: 'Falha ao gerar plano com IA. Verifique as configurações do LLM_PROVIDER.' },
      { status: 502 },
    );
  }

  // Upsert — allow regeneration
  const plan = await prisma.actionPlan.upsert({
    where: { campaign_id: id },
    create: {
      campaign_id: id,
      model_used: generated.model_used,
      problems: generated.problems as never,
      generated_at: new Date(),
      updated_at: new Date(),
    },
    update: {
      model_used: generated.model_used,
      problems: generated.problems as never,
      generated_at: new Date(),
      updated_at: new Date(),
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
