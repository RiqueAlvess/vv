import { prisma } from '@/lib/prisma';
import { ScoreService } from './score.service';
import { HSE_DIMENSIONS, AGE_RANGES } from '@/lib/constants';
import { DASHBOARD_CACHE_VERSION } from '@/lib/dashboard-cache';
import type { DimensionType, RiskLevel } from '@/types';

// ─── Local types ──────────────────────────────────────────────────────────────

type ParsedResponse = {
  id: string;
  gender: string | null;
  age_range: string | null;
  unit_id: string | null;
  sector_id: string | null;
  position_id: string | null;
  responses: Record<string, number>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  M: 'Masculino',
  F: 'Feminino',
  O: 'Outro',
  N: 'Não informado',
};

const RISK_LEVEL_WEIGHT: Record<RiskLevel, number> = {
  critico: 4,
  importante: 3,
  moderado: 2,
  aceitavel: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getResponseDimensionRisk(
  response: ParsedResponse,
  dimension: typeof HSE_DIMENSIONS[number],
) {
  const score = ScoreService.calculateDimensionScore(
    response.responses,
    dimension.key as DimensionType,
  );
  const riskLevel = ScoreService.getRiskLevel(score, dimension.type);
  const nr = ScoreService.calculateNR(riskLevel);
  return { score, riskLevel, nr };
}

function aggregateDimensionAnalysis(responses: ParsedResponse[]) {
  return HSE_DIMENSIONS.map((dim) => {
    let scoreSum = 0;
    let scoreCount = 0;
    const riskCount = {
      aceitavel: 0,
      moderado: 0,
      importante: 0,
      critico: 0,
    } satisfies Record<RiskLevel, number>;

    for (const resp of responses) {
      const { score, riskLevel } = getResponseDimensionRisk(resp, dim);
      if (!Number.isFinite(score)) continue;
      scoreSum += score;
      scoreCount++;
      riskCount[riskLevel]++;
    }

    const avgScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0;
    // Classify by average score (consistent with heatmap and dashboard/route.ts)
    const riskLevel = ScoreService.getRiskLevel(avgScore, dim.type);
    const nr = ScoreService.calculateNR(riskLevel);
    const interp = ScoreService.interpretNR(nr);

    return {
      key: dim.key,
      name: dim.name,
      type: dim.type,
      avg_score: avgScore,
      risk_level: riskLevel,
      probability: RISK_LEVEL_WEIGHT[riskLevel],
      severity: RISK_LEVEL_WEIGHT[riskLevel],
      nr,
      nr_label: interp.label,
      nr_color: interp.color,
      risk_distribution: riskCount,
      sample_size: scoreCount,
    };
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calculates all analytics for a closed campaign and upserts CampaignMetrics.
 * Called by the job worker — never called synchronously in a request.
 *
 * The stored payload format must match:
 *  - hasCompatibleDashboardShape() in dashboard-cache.ts
 *  - buildPayloadFromCache() in dashboard-cache.ts
 */
export async function calculateAndStoreCampaignMetrics(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true, name: true },
  });

  if (!campaign || campaign.status !== 'closed') {
    throw new Error(`Campaign ${campaignId} is not closed — cannot calculate metrics`);
  }

  const rawResponses = await prisma.surveyResponse.findMany({
    where: { campaign_id: campaignId },
    select: {
      id: true,
      gender: true,
      age_range: true,
      unit_id: true,
      sector_id: true,
      position_id: true,
      responses: true,
    },
  });

  if (!rawResponses.length) {
    console.log(`[Metrics] No responses for campaign ${campaignId} — skipping`);
    return;
  }

  const responses: ParsedResponse[] = rawResponses.map((r) => ({
    ...r,
    responses: (r.responses ?? {}) as Record<string, number>,
  }));

  const totalInvited = 0; // QR code model — no fixed invited pool
  const totalResponded = responses.length;

  // ── Dimension analysis ──────────────────────────────────────────────────────
  const dimensionAnalysis = aggregateDimensionAnalysis(responses);
  const igrp = Number(
    (dimensionAnalysis.reduce((sum, d) => sum + d.nr, 0) / dimensionAnalysis.length).toFixed(2),
  );
  const igrpInterp = ScoreService.interpretNR(igrp);

  // ── Worker-level risk counts ─────────────────────────────────────────────────
  let workersHighRisk = 0;
  let workersCritical = 0;
  let highRiskEvaluations = 0;
  let criticalEvaluations = 0;
  let totalEvaluations = 0;

  for (const resp of responses) {
    let workerHasHighRisk = false;
    let workerHasCriticalRisk = false;
    for (const dim of HSE_DIMENSIONS) {
      const { nr } = getResponseDimensionRisk(resp, dim);
      totalEvaluations++;
      if (nr >= 9) { highRiskEvaluations++; workerHasHighRisk = true; }
      if (nr >= 13) { criticalEvaluations++; workerHasCriticalRisk = true; }
    }
    if (workerHasHighRisk) workersHighRisk++;
    if (workerHasCriticalRisk) workersCritical++;
  }

  const workersHighRiskPct = Math.round((workersHighRisk / totalResponded) * 100);
  const workersCriticalPct = Math.round((workersCritical / totalResponded) * 100);
  const workersHighRiskEvalPct = totalEvaluations > 0
    ? Math.round((highRiskEvaluations / totalEvaluations) * 100) : 0;
  const workersCriticalEvalPct = totalEvaluations > 0
    ? Math.round((criticalEvaluations / totalEvaluations) * 100) : 0;

  // ── Stacked by dimension ────────────────────────────────────────────────────
  const stackedByDimension = HSE_DIMENSIONS.map((dim) => {
    const counts: Record<RiskLevel, number> = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
    for (const resp of responses) {
      const { riskLevel } = getResponseDimensionRisk(resp, dim);
      counts[riskLevel]++;
    }
    return {
      dimension: dim.name,
      key: dim.key,
      aceitavel_pct: Math.round((counts.aceitavel / totalResponded) * 100),
      moderado_pct: Math.round((counts.moderado / totalResponded) * 100),
      importante_pct: Math.round((counts.importante / totalResponded) * 100),
      critico_pct: Math.round((counts.critico / totalResponded) * 100),
      counts,
    };
  });

  // ── Stacked by question ─────────────────────────────────────────────────────
  const stackedByQuestion = HSE_DIMENSIONS
    .flatMap((dim) => dim.questionNumbers.map((qn) => ({ dim, qn })))
    .map(({ dim, qn }) => {
      const counts: Record<RiskLevel, number> = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
      let answered = 0;
      for (const resp of responses) {
        const val = ScoreService.getQuestionAnswer(resp.responses, qn);
        if (typeof val !== 'number') continue;
        const risk = ScoreService.getRiskLevel(val, dim.type);
        counts[risk]++;
        answered++;
      }
      const total = answered || 1;
      return {
        question_number: qn,
        dimension: dim.name,
        dimension_key: dim.key,
        type: dim.type,
        aceitavel_pct: Math.round((counts.aceitavel / total) * 100),
        moderado_pct: Math.round((counts.moderado / total) * 100),
        importante_pct: Math.round((counts.importante / total) * 100),
        critico_pct: Math.round((counts.critico / total) * 100),
        answered,
      };
    })
    .sort((a, b) => a.question_number - b.question_number);

  // ── Heatmap (by unit) ───────────────────────────────────────────────────────
  const units = await prisma.campaignUnit.findMany({
    where: { campaign_id: campaignId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const heatmapData = units.map((unit) => {
    const unitResponses = responses.filter((r) => r.unit_id === unit.id);
    if (unitResponses.length === 0) {
      return {
        unit: unit.name,
        dimensions: Object.fromEntries(
          HSE_DIMENSIONS.map((dim) => [dim.key, { nr: null, color: '#CBD5E1', label: 'Sem dados' }]),
        ),
      };
    }
    return {
      unit: unit.name,
      dimensions: Object.fromEntries(
        HSE_DIMENSIONS.map((dim) => {
          const avgScore =
            unitResponses.reduce(
              (sum, r) => sum + ScoreService.calculateDimensionScore(r.responses, dim.key as DimensionType),
              0,
            ) / unitResponses.length;
          const risk = ScoreService.getRiskLevel(avgScore, dim.type);
          const nr = ScoreService.calculateNR(risk);
          const { label, color } = ScoreService.interpretNR(nr);
          return [dim.key, { nr, color, label }];
        }),
      ),
    };
  });

  // ── Top sectors by NR ───────────────────────────────────────────────────────
  const sectors = await prisma.campaignSector.findMany({
    where: { unit: { campaign_id: campaignId } },
    select: { id: true, name: true, unit: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  const topSectorsByNR = sectors
    .map((sector) => {
      const sectorResponses = responses.filter((r) => r.sector_id === sector.id);
      if (sectorResponses.length === 0) {
        return { sector: sector.name, unit: sector.unit.name, nr: 0, label: 'Sem dados', color: '#CBD5E1' };
      }
      const sectorDims = aggregateDimensionAnalysis(sectorResponses);
      const sectorNR = Number(
        (sectorDims.reduce((sum, d) => sum + d.nr, 0) / sectorDims.length).toFixed(2),
      );
      const interp = ScoreService.interpretNR(sectorNR);
      return { sector: sector.name, unit: sector.unit.name, nr: sectorNR, label: interp.label, color: interp.color };
    })
    .sort((a, b) => b.nr - a.nr)
    .slice(0, 5);

  // ── Position table ──────────────────────────────────────────────────────────
  const positions = await prisma.campaignPosition.findMany({
    where: { sector: { unit: { campaign_id: campaignId } } },
    select: {
      id: true,
      name: true,
      sector: { select: { id: true, name: true, unit: { select: { name: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  const positionTable = positions
    .map((pos) => {
      const posResponses = responses.filter((r) => r.position_id === pos.id);
      if (posResponses.length === 0) return null;
      const posDims = aggregateDimensionAnalysis(posResponses);
      const posNR = Number((posDims.reduce((sum, d) => sum + d.nr, 0) / posDims.length).toFixed(1));
      const { label } = ScoreService.interpretNR(posNR);
      const avgHSEScore = Number(
        (posDims.reduce((sum, d) => sum + d.avg_score, 0) / posDims.length).toFixed(2),
      );
      return {
        position: pos.name,
        sector: pos.sector.name,
        unit: pos.sector.unit.name,
        avg_hse_score: avgHSEScore,
        classification: label,
        nr: posNR,
        n_responses: posResponses.length,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.nr - a.nr);

  const topPositionsByNR = positionTable
    .map((pos) => ({
      position: pos.position,
      sector: pos.sector,
      unit: pos.unit,
      nr: pos.nr,
      label: pos.classification,
      color: ScoreService.interpretNR(pos.nr).color,
    }))
    .slice(0, 5);

  // ── Demographic distributions & risk charts ──────────────────────────────────
  const genderCounts: Record<string, number> = {};
  const ageCounts: Record<string, number> = {};

  type GroupAccumulator = {
    total: number;
    highRiskWorkers: number;
    criticalWorkers: number;
    highRiskEvaluations: number;
    criticalEvaluations: number;
    totalEvaluations: number;
    byDimension: Record<string, { nrSum: number; count: number }>;
  };

  const genderGroups: Record<string, GroupAccumulator> = {};
  const ageGroups: Record<string, GroupAccumulator> = {};

  for (const resp of responses) {
    const genderKey = GENDER_LABELS[resp.gender ?? 'N'] ?? 'Não informado';
    const ageKey = resp.age_range && AGE_RANGES.includes(resp.age_range) ? resp.age_range : 'Não informado';

    genderCounts[genderKey] = (genderCounts[genderKey] ?? 0) + 1;
    ageCounts[ageKey] = (ageCounts[ageKey] ?? 0) + 1;

    const emptyGroup = (): GroupAccumulator => ({
      total: 0, highRiskWorkers: 0, criticalWorkers: 0,
      highRiskEvaluations: 0, criticalEvaluations: 0, totalEvaluations: 0, byDimension: {},
    });

    if (!genderGroups[genderKey]) genderGroups[genderKey] = emptyGroup();
    if (!ageGroups[ageKey]) ageGroups[ageKey] = emptyGroup();

    genderGroups[genderKey].total++;
    ageGroups[ageKey].total++;

    let genderHighRisk = false, genderCritical = false;
    let ageHighRisk = false, ageCritical = false;

    for (const dim of HSE_DIMENSIONS) {
      const { nr } = getResponseDimensionRisk(resp, dim);

      genderGroups[genderKey].totalEvaluations++;
      ageGroups[ageKey].totalEvaluations++;

      if (nr >= 9) {
        genderGroups[genderKey].highRiskEvaluations++;
        ageGroups[ageKey].highRiskEvaluations++;
        genderHighRisk = true;
        ageHighRisk = true;
      }
      if (nr >= 13) {
        genderGroups[genderKey].criticalEvaluations++;
        ageGroups[ageKey].criticalEvaluations++;
        genderCritical = true;
        ageCritical = true;
      }

      if (!genderGroups[genderKey].byDimension[dim.key]) {
        genderGroups[genderKey].byDimension[dim.key] = { nrSum: 0, count: 0 };
      }
      genderGroups[genderKey].byDimension[dim.key].nrSum += nr;
      genderGroups[genderKey].byDimension[dim.key].count++;

      if (!ageGroups[ageKey].byDimension[dim.key]) {
        ageGroups[ageKey].byDimension[dim.key] = { nrSum: 0, count: 0 };
      }
      ageGroups[ageKey].byDimension[dim.key].nrSum += nr;
      ageGroups[ageKey].byDimension[dim.key].count++;
    }

    if (genderHighRisk) genderGroups[genderKey].highRiskWorkers++;
    if (genderCritical) genderGroups[genderKey].criticalWorkers++;
    if (ageHighRisk) ageGroups[ageKey].highRiskWorkers++;
    if (ageCritical) ageGroups[ageKey].criticalWorkers++;
  }

  function buildGroupChart(
    groups: Record<string, GroupAccumulator>,
    labelKey: 'gender' | 'age_range',
  ) {
    return Object.entries(groups)
      .filter(([, g]) => g.total > 0)
      .map(([label, g]) => {
        const highRiskWorkerPct = Math.round((g.highRiskWorkers / g.total) * 100);
        const criticalWorkerPct = Math.round((g.criticalWorkers / g.total) * 100);
        const highRiskEvalPct = g.totalEvaluations > 0
          ? Math.round((g.highRiskEvaluations / g.totalEvaluations) * 100) : 0;
        const worstDim = Object.entries(g.byDimension)
          .map(([key, d]) => ({
            key,
            name: HSE_DIMENSIONS.find((hd) => hd.key === key)?.name ?? key,
            avgNR: d.count > 0 ? d.nrSum / d.count : 0,
          }))
          .sort((a, b) => b.avgNR - a.avgNR)[0];

        const base = {
          total_responses: g.total,
          critical_pct: highRiskWorkerPct,
          high_risk_worker_pct: highRiskWorkerPct,
          critical_worker_pct: criticalWorkerPct,
          high_risk_eval_pct: highRiskEvalPct,
          worst_dimension: worstDim?.name ?? null,
          worst_dimension_nr: worstDim ? Number(worstDim.avgNR.toFixed(1)) : 0,
          suppressed: false,
          dimensions: Object.fromEntries(
            Object.entries(g.byDimension).map(([key, d]) => [
              key,
              d.count > 0 ? Number((d.nrSum / d.count).toFixed(1)) : 0,
            ]),
          ),
        };

        return labelKey === 'gender'
          ? { gender: label, ...base }
          : { age_range: label, ...base };
      });
  }

  const genderChartData = buildGroupChart(genderGroups, 'gender')
    .sort((a, b) => b.critical_pct - a.critical_pct);

  const ageChartData = buildGroupChart(ageGroups, 'age_range')
    .sort((a, b) => {
      const ai = AGE_RANGES.indexOf((a as { age_range: string }).age_range);
      const bi = AGE_RANGES.indexOf((b as { age_range: string }).age_range);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  // ── Persist ─────────────────────────────────────────────────────────────────
  const now = new Date();

  const metricsData = {
    total_invited: totalInvited,
    total_responded: totalResponded,
    response_rate: 0,
    igrp: Math.round(igrp * 100) / 100,
    // dimension_scores must be an Array for hasCompatibleDashboardShape
    dimension_scores: dimensionAnalysis,
    // risk_distribution must match DASHBOARD_CACHE_VERSION and include stacked arrays
    risk_distribution: {
      payload_version: DASHBOARD_CACHE_VERSION,
      campaign_name: campaign.name,
      igrp_label: igrpInterp.label,
      igrp_color: igrpInterp.color,
      workers_high_risk_pct: workersHighRiskPct,
      workers_critical_pct: workersCriticalPct,
      workers_high_risk_eval_pct: workersHighRiskEvalPct,
      workers_critical_eval_pct: workersCriticalEvalPct,
      stacked_by_dimension: stackedByDimension,
      stacked_by_question: stackedByQuestion,
    },
    // demographic_data must have gender_distribution and age_distribution as objects
    demographic_data: {
      gender_distribution: genderCounts,
      age_distribution: ageCounts,
    },
    heatmap_data: heatmapData,
    // top_critical_sectors must have top_sectors_by_nr and top_positions_by_nr as arrays
    top_critical_sectors: {
      top_sectors_by_nr: topSectorsByNR,
      top_positions_by_nr: topPositionsByNR,
    },
    scores_by_gender: genderChartData,
    scores_by_age: ageChartData,
    top_critical_groups: positionTable,
    calculated_at: now,
    updated_at: now,
  };

  await prisma.campaignMetrics.upsert({
    where: { campaign_id: campaignId },
    create: { campaign_id: campaignId, ...metricsData },
    update: metricsData,
  });

  console.log(`[Metrics] Stored metrics for campaign ${campaignId} (${totalResponded} responses)`);
}
