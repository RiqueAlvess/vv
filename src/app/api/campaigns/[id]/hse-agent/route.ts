import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { enqueueJob } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET — retrieve existing action plan (or generating status)
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
  if (plan) return NextResponse.json(plan);

  // Check for a pending/processing job
  const pending = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM core.jobs
    WHERE type = 'generate_action_plan'
      AND status IN ('pending', 'processing')
      AND payload->>'campaign_id' = ${id}
    LIMIT 1
  `;
  if (pending.length) {
    return NextResponse.json({ status: 'generating' }, { status: 202 });
  }

  return NextResponse.json({ error: 'Plano de ação não gerado ainda' }, { status: 404 });
}

// ---------------------------------------------------------------------------
// POST — enqueue background action plan generation
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
    select: { id: true, company_id: true, status: true },
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

  // Guard: plan already exists
  const existing = await prisma.actionPlan.findUnique({ where: { campaign_id: id }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: 'O plano de ação já foi gerado para esta campanha.' },
      { status: 409 },
    );
  }

  // Guard: job already queued
  const pending = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM core.jobs
    WHERE type = 'generate_action_plan'
      AND status IN ('pending', 'processing')
      AND payload->>'campaign_id' = ${id}
    LIMIT 1
  `;
  if (pending.length) {
    return NextResponse.json({ status: 'generating', message: 'Plano já está sendo gerado.' }, { status: 202 });
  }

  // Validate responses exist
  const responseCount = await prisma.surveyResponse.count({ where: { campaign_id: id } });
  if (responseCount === 0) {
    return NextResponse.json({ error: 'Nenhuma resposta encontrada para gerar o plano' }, { status: 400 });
  }

  await enqueueJob('generate_action_plan', { campaign_id: id });

  return NextResponse.json({ status: 'queued', message: 'Geração iniciada em segundo plano.' }, { status: 202 });
}
