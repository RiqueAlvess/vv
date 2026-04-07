'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { ScoreService } from '@/services/score.service';
import { DashboardService } from '@/services/dashboard.service';
import { HSE_DIMENSIONS } from '@/lib/constants';
import type { SurveyResponse, DashboardData } from '@/types';

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function err(error: string): Err { return { success: false, error }; }

// ─── Dashboard Lock guard ──────────────────────────────────────────────────

async function assertClosedCampaign(
  campaignId: string,
  companyId: string,
  role: string
): Promise<{ company_id: string; status: string } | string> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { company_id: true, status: true },
  });
  if (!campaign) return 'Campanha não encontrada';
  if (campaign.status !== 'closed') return 'Dashboard disponível apenas para campanhas encerradas';
  if (role !== 'ADM' && campaign.company_id !== companyId) return 'Sem permissão';
  return campaign;
}

// ─── Compute + persist metrics ─────────────────────────────────────────────

/**
 * Computes all analytics for a CLOSED campaign and upserts the
 * CampaignMetrics record. Idempotent — safe to call multiple times.
 *
 * DASHBOARD LOCK: throws if campaign is not 'closed'.
 */
export async function computeCampaignMetrics(
  campaignId: string
): Promise<Result<{ campaign_id: string; calculated_at: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM' && session.role !== 'RH') return err('Sem permissão');

  const guard = await assertClosedCampaign(campaignId, session.company_id, session.role);
  if (typeof guard === 'string') return err(guard);

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

  if (!rawResponses.length) return err('Sem respostas para calcular métricas');

  const responses = rawResponses.map((r) => ({
    ...r,
    responses: r.responses as Record<string, number>,
    created_at: r.created_at.toISOString(),
  })) as SurveyResponse[];

  const totalInvited = 0; // QR code model — no fixed invited pool
  const totalResponded = responses.length;
  const responseRate = totalInvited ? (totalResponded / totalInvited) * 100 : 0;

  // Core analytics — all delegated to pure service functions
  const dimensionScores = DashboardService.getDimensionScores(responses);
  const igrp = ScoreService.calculateIGRP(dimensionScores as Parameters<typeof ScoreService.calculateIGRP>[0]);
  const riskDistribution = DashboardService.getRiskDistribution(responses);
  const genderDist = DashboardService.getGenderDistribution(responses);
  const ageDist = DashboardService.getAgeDistribution(responses);
  const scoresByGender = DashboardService.getScoresByGender(responses);
  const scoresByAge = DashboardService.getScoresByAge(responses);

  // Sector mapping: session_uuid → sector name (from analytics dim_sectors)
  const sectorMapping = await buildSectorMapping(campaignId);

  const heatmap = DashboardService.getHeatmapData(responses, sectorMapping);
  const topCriticalSectors = DashboardService.getTopCriticalSectors(responses, sectorMapping);
  const topCriticalGroups = DashboardService.getTopCriticalGroups(responses);

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

  return ok({ campaign_id: campaignId, calculated_at: now.toISOString() });
}

// ─── Dashboard data fetch ──────────────────────────────────────────────────

/**
 * Returns the full dashboard payload for a CLOSED campaign.
 * Serves pre-calculated CampaignMetrics if available, otherwise
 * falls back to on-the-fly computation.
 *
 * DASHBOARD LOCK: returns an error if campaign is not 'closed'.
 * LIDERANCA role receives a restricted flag (sector-filtered data TBD).
 */
export async function getCampaignDashboard(
  campaignId: string
): Promise<Result<DashboardData & { restricted?: boolean }>> {
  const session = await requireSession();

  const guard = await assertClosedCampaign(campaignId, session.company_id, session.role);
  if (typeof guard === 'string') return err(guard);

  // Try the pre-computed metrics first
  const cached = await prisma.campaignMetrics.findUnique({ where: { campaign_id: campaignId } });

  if (cached) {
    const dimensionScores = cached.dimension_scores as Record<string, number>;

    const dashboardData: DashboardData & { restricted?: boolean } = {
      metrics: {
        id: cached.id,
        campaign_id: cached.campaign_id,
        total_employees: cached.total_employees ?? 0,
        total_invited: cached.total_invited,
        total_responded: cached.total_responded,
        response_rate: Number(cached.response_rate),
        igrp: cached.igrp ? Number(cached.igrp) : 0,
        risk_distribution: (cached.risk_distribution ?? {}) as Record<string, number>,
        dimension_scores: dimensionScores,
        demographic_data: (cached.demographic_data ?? {}) as Record<string, unknown>,
        heatmap_data: (cached.heatmap_data ?? {}) as Record<string, unknown>,
        top_critical_sectors: ((cached.top_critical_sectors as unknown) ?? []) as Record<string, unknown>[],
        scores_by_gender: (cached.scores_by_gender ?? {}) as Record<string, unknown>,
        scores_by_age: (cached.scores_by_age ?? {}) as Record<string, unknown>,
        top_critical_groups: ((cached.top_critical_groups as unknown) ?? []) as Record<string, unknown>[],
        calculated_at: cached.calculated_at?.toISOString() ?? new Date().toISOString(),
      },
      dimension_scores: dimensionScores,
      radar_data: HSE_DIMENSIONS.map((dim) => ({
        dimension: dim.name,
        score: dimensionScores[dim.key] ?? 0,
      })),
      top_sectors: ((cached.top_critical_sectors as unknown) ?? []) as Record<string, unknown>[],
      risk_distribution: (cached.risk_distribution ?? {}) as Record<string, number>,
      gender_distribution: ((cached.demographic_data as Record<string, unknown>)?.gender ?? {}) as Record<string, number>,
      age_distribution: ((cached.demographic_data as Record<string, unknown>)?.age ?? {}) as Record<string, number>,
      heatmap: (cached.heatmap_data ?? {}) as Record<string, unknown>,
      scores_by_gender: (cached.scores_by_gender ?? {}) as Record<string, unknown>,
      scores_by_age: (cached.scores_by_age ?? {}) as Record<string, unknown>,
      top_critical_groups: ((cached.top_critical_groups as unknown) ?? []) as Record<string, unknown>[],
      ...(session.role === 'LIDERANCA' && { restricted: true }),
    };

    return ok(dashboardData);
  }

  // Fallback: compute on-the-fly (raw responses)
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

  if (!rawResponses.length) return err('Nenhuma resposta encontrada para esta campanha');

  const responses = rawResponses.map((r) => ({
    ...r,
    responses: r.responses as Record<string, number>,
    created_at: r.created_at.toISOString(),
  })) as SurveyResponse[];

  const totalInvited = 0; // QR code model — no fixed invited pool
  const dimensionScores = DashboardService.getDimensionScores(responses);
  const igrp = ScoreService.calculateIGRP(dimensionScores as Parameters<typeof ScoreService.calculateIGRP>[0]);
  const riskDistribution = DashboardService.getRiskDistribution(responses);
  const genderDist = DashboardService.getGenderDistribution(responses);
  const ageDist = DashboardService.getAgeDistribution(responses);

  const dashboardData: DashboardData & { restricted?: boolean } = {
    metrics: {
      id: '',
      campaign_id: campaignId,
      total_employees: 0,
      total_invited: totalInvited,
      total_responded: responses.length,
      response_rate: totalInvited ? Math.round((responses.length / totalInvited) * 10000) / 100 : 0,
      igrp,
      risk_distribution: riskDistribution,
      dimension_scores: dimensionScores,
      demographic_data: { gender: genderDist, age: ageDist },
      heatmap_data: {},
      top_critical_sectors: [],
      scores_by_gender: {},
      scores_by_age: {},
      top_critical_groups: [],
      calculated_at: new Date().toISOString(),
    },
    dimension_scores: dimensionScores,
    radar_data: HSE_DIMENSIONS.map((dim) => ({
      dimension: dim.name,
      score: dimensionScores[dim.key] ?? 0,
    })),
    top_sectors: [],
    risk_distribution: riskDistribution,
    gender_distribution: genderDist as unknown as Record<string, number>,
    age_distribution: ageDist as unknown as Record<string, number>,
    heatmap: {},
    scores_by_gender: {},
    scores_by_age: {},
    top_critical_groups: [],
    ...(session.role === 'LIDERANCA' && { restricted: true }),
  };

  return ok(dashboardData);
}

// ─── Pure helper ───────────────────────────────────────────────────────────

/**
 * Builds a session_uuid → sector_name mapping by joining the analytics
 * dim_sectors snapshot. Used for heatmap + top critical sectors computation.
 *
 * Because SurveyResponse has no FK to the org structure, this join is done
 * at analytics time via the DimSector snapshot taken when the campaign closed.
 *
 * NOTE: dim_sectors currently doesn't store response session_uuids directly —
 * this returns an empty map until a sector assignment job is implemented.
 * The DashboardService handles this gracefully (groups unknown as 'Sem Setor').
 */
async function buildSectorMapping(campaignId: string): Promise<Record<string, string>> {
  // dim_sectors holds the org snapshot (unit/sector/position names) at campaign close.
  // Actual per-response sector inference requires a separate ETL step (e.g. matching
  // by demographic group). Returning empty map here — safe default.
  void campaignId; // acknowledged unused until ETL is wired
  return {};
}
