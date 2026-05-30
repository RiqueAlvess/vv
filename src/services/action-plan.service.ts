import { prisma } from '@/lib/prisma';
import { generateActionPlan } from '@/lib/hse-agent';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from './score.service';
import type { DimensionType } from '@/types';

export async function generateAndStoreActionPlan(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, status: true, company: { select: { name: true } } },
  });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status !== 'closed') throw new Error(`Campaign ${campaignId} is not closed`);

  // Idempotency: skip if plan already exists
  const existing = await prisma.actionPlan.findUnique({ where: { campaign_id: campaignId }, select: { id: true } });
  if (existing) {
    console.log(`[ActionPlan] Plan already exists for campaign ${campaignId} — skipping`);
    return;
  }

  const rawResponses = await prisma.surveyResponse.findMany({
    where: { campaign_id: campaignId },
    select: { responses: true },
  });
  if (!rawResponses.length) throw new Error(`No responses found for campaign ${campaignId}`);

  const dimensions = HSE_DIMENSIONS.map((dim) => {
    let scoreSum = 0;
    let count = 0;
    for (const r of rawResponses) {
      const score = ScoreService.calculateDimensionScore(
        (r.responses ?? {}) as Record<string, number>,
        dim.key as DimensionType,
      );
      if (Number.isFinite(score)) { scoreSum += score; count++; }
    }
    const avg_score = count > 0 ? Number((scoreSum / count).toFixed(2)) : 0;
    const risk_level = ScoreService.getRiskLevel(avg_score, dim.type);
    const nr = ScoreService.calculateNR(risk_level, dim.key);
    const { label } = ScoreService.interpretNR(nr);
    return { key: dim.key, name: dim.name, type: dim.type, avg_score, risk_level, nr, nr_label: label };
  });

  const igrp = Number((dimensions.reduce((s, d) => s + d.nr, 0) / dimensions.length).toFixed(2));
  const { label: igrp_label } = ScoreService.interpretNR(igrp);

  const generated = await generateActionPlan({
    campaign_name: campaign.name,
    company_name: campaign.company.name,
    total_responded: rawResponses.length,
    igrp,
    igrp_label,
    dimensions,
  });

  await prisma.actionPlan.create({
    data: {
      campaign_id: campaignId,
      model_used: generated.model_used,
      problems: generated.problems as never,
      generated_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log(`[ActionPlan] Generated plan for campaign ${campaignId}`);
}
