import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import type { ActionPlanProblem } from '@/lib/hse-agent';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // LIDERANCA cannot access action plans (no write permissions and no company-wide view)
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const where = user.role === 'ADM'
    ? {}
    : { campaign: { company_id: user.company_id } };

  const plans = await prisma.actionPlan.findMany({
    where,
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          start_date: true,
          end_date: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { updated_at: 'desc' },
  });

  const result = plans.map((plan) => {
    const problems = plan.problems as ActionPlanProblem[];
    const totalActions = problems.reduce((sum, p) => sum + (p.actions?.length ?? 0), 0);
    const doneActions = problems.reduce(
      (sum, p) => sum + (p.actions?.filter((a) => a.status === 'concluida').length ?? 0),
      0,
    );
    const criticalProblems = problems.filter((p) => p.risk_level === 'critico').length;
    const importantProblems = problems.filter((p) => p.risk_level === 'importante').length;

    return {
      id: plan.id,
      campaign_id: plan.campaign_id,
      campaign_name: plan.campaign.name,
      campaign_status: plan.campaign.status,
      campaign_start: plan.campaign.start_date,
      campaign_end: plan.campaign.end_date,
      company_id: plan.campaign.company.id,
      company_name: plan.campaign.company.name,
      model_used: plan.model_used,
      total_problems: problems.length,
      critical_problems: criticalProblems,
      important_problems: importantProblems,
      total_actions: totalActions,
      done_actions: doneActions,
      completion_pct: totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0,
      generated_at: plan.generated_at,
      updated_at: plan.updated_at,
    };
  });

  return NextResponse.json(result);
}
