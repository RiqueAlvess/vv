import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import type { ActionPlanProblem } from '@/lib/hse-agent';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

// GET — same as /hse-agent GET (alias for the frontend)
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { company_id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const plan = await prisma.actionPlan.findUnique({ where: { campaign_id: id } });
  if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });

  return NextResponse.json(plan);
}

// PATCH — save user edits to problems (full problems array replace)
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role !== 'ADM' && user.role !== 'RH' && user.role !== 'MEDICO') {
    return NextResponse.json({ error: 'Sem permissão para editar o plano de ação' }, { status: 403 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { company_id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (user.role === 'RH' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json() as { problems: ActionPlanProblem[] };
  if (!Array.isArray(body.problems)) {
    return NextResponse.json({ error: 'problems deve ser um array' }, { status: 400 });
  }

  const plan = await prisma.actionPlan.update({
    where: { campaign_id: id },
    data: { problems: body.problems as never, updated_at: new Date() },
  });

  return NextResponse.json(plan);
}
