import { prisma } from '@/lib/prisma';
import { ScoreService } from './score.service';
import { DashboardService } from './dashboard.service';
import type { SurveyResponse } from '@/types';

/**
 * Calculates all analytics for a closed campaign and upserts CampaignMetrics.
 * Called by the job worker — never called synchronously in a request.
 */
export async function calculateAndStoreCampaignMetrics(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  if (!campaign || campaign.status !== 'closed') {
    throw new Error(`Campaign ${campaignId} is not closed — cannot calculate metrics`);
  }

  const rawResponses = await prisma.surveyResponse.findMany({
    where: { campaign_id: campaignId },
    select: {
      id: true,
      campaign_id: true,
      session_uuid: true,
      gender: true,
      age_range: true,
      consent_accepted: true,
      responses: true,
      created_at: true,
    },
  });

  if (!rawResponses.length) {
    console.log(`[Metrics] No responses for campaign ${campaignId} — skipping`);
    return;
  }

  const responses = rawResponses.map((r) => ({
    ...r,
    responses: r.responses as Record<string, number>,
    created_at: r.created_at.toISOString(),
  })) as SurveyResponse[];

  const totalInvited = await prisma.surveyInvitation.count({
    where: { campaign_id: campaignId },
  });
  const totalResponded = responses.length;
  const responseRate = totalInvited ? (totalResponded / totalInvited) * 100 : 0;

  const dimensionScores = DashboardService.getDimensionScores(responses);
  const igrp = ScoreService.calculateIGRP(
    dimensionScores as Parameters<typeof ScoreService.calculateIGRP>[0]
  );
  const riskDistribution = DashboardService.getRiskDistribution(responses);
  const genderDist = DashboardService.getGenderDistribution(responses);
  const ageDist = DashboardService.getAgeDistribution(responses);
  const scoresByGender = DashboardService.getScoresByGender(responses);
  const scoresByAge = DashboardService.getScoresByAge(responses);
  const topCriticalGroups = DashboardService.getTopCriticalGroups(responses);
  const heatmap = DashboardService.getHeatmapData(responses, {});
  const topCriticalSectors = DashboardService.getTopCriticalSectors(responses, {});

  const now = new Date();

  await prisma.campaignMetrics.upsert({
    where: { campaign_id: campaignId },
    create: {
      campaign_id: campaignId,
      total_invited: totalInvited,
      total_responded: totalResponded,
      response_rate: Math.round(responseRate * 100) / 100,
      igrp: Math.round(igrp * 100) / 100,
      dimension_scores: dimensionScores,
      risk_distribution: riskDistribution,
      demographic_data: { gender: genderDist, age: ageDist },
      heatmap_data: heatmap,
      top_critical_sectors: topCriticalSectors,
      scores_by_gender: scoresByGender,
      scores_by_age: scoresByAge,
      top_critical_groups: topCriticalGroups,
      calculated_at: now,
    },
    update: {
      total_invited: totalInvited,
      total_responded: totalResponded,
      response_rate: Math.round(responseRate * 100) / 100,
      igrp: Math.round(igrp * 100) / 100,
      dimension_scores: dimensionScores,
      risk_distribution: riskDistribution,
      demographic_data: { gender: genderDist, age: ageDist },
      heatmap_data: heatmap,
      top_critical_sectors: topCriticalSectors,
      scores_by_gender: scoresByGender,
      scores_by_age: scoresByAge,
      top_critical_groups: topCriticalGroups,
      calculated_at: now,
    },
  });

  console.log(`[Metrics] Calculated and stored metrics for campaign ${campaignId}`);
}
