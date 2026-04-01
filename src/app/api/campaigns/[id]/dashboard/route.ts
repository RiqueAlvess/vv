import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from '@/services/score.service';
import type { RiskLevel, DimensionType } from '@/types';

interface RouteParams { params: Promise<{ id: string }> }

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Cache helper — isolated for testability
// ---------------------------------------------------------------------------

/**
 * Attempt to serve dashboard metrics from the CampaignMetrics cache.
 *
 * Rules:
 *  - closed campaign  → always return cached data (immutable result set)
 *  - active campaign  → return cached data only when < 5 min old
 *  - missing / empty cache → return null (caller falls through to live compute)
 */
export async function getCampaignMetricsWithCache(
  campaignId: string,
  status: string,
): Promise<Record<string, unknown> | null> {
  const cached = await prisma.campaignMetrics.findUnique({
    where: { campaign_id: campaignId },
  });

  if (!cached || !cached.risk_distribution) return null;

  if (status === 'closed') {
    return buildPayloadFromCache(campaignId, cached);
  }

  // Active (or other) campaigns: respect TTL
  const ageMs = Date.now() - new Date(cached.updated_at).getTime();
  if (ageMs < CACHE_TTL_MS) {
    return buildPayloadFromCache(campaignId, cached);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal helper — reconstruct response shape from stored columns
// ---------------------------------------------------------------------------

type StoredMetrics = Awaited<ReturnType<typeof prisma.campaignMetrics.findUnique>>;

function buildPayloadFromCache(
  campaignId: string,
  cached: NonNullable<StoredMetrics>,
): Record<string, unknown> {
  // risk_distribution stores: campaign_name, igrp_label, igrp_color,
  //   workers_high_risk_pct, workers_critical_pct, stacked_by_dimension, stacked_by_question
  const rd = (cached.risk_distribution ?? {}) as Record<string, unknown>;
  const tc = (cached.top_critical_sectors ?? {}) as Record<string, unknown>;
  const dd = (cached.demographic_data ?? {}) as Record<string, unknown>;

  return {
    campaign_id: campaignId,
    campaign_name: rd.campaign_name ?? null,
    total_invited: cached.total_invited,
    total_responded: cached.total_responded,
    response_rate: Number(cached.response_rate),
    igrp: Number(cached.igrp ?? 0),
    igrp_label: rd.igrp_label ?? null,
    igrp_color: rd.igrp_color ?? null,
    workers_high_risk_pct: rd.workers_high_risk_pct ?? 0,
    workers_critical_pct: rd.workers_critical_pct ?? 0,
    dimension_analysis: cached.dimension_scores ?? [],
    stacked_by_dimension: rd.stacked_by_dimension ?? [],
    stacked_by_question: rd.stacked_by_question ?? [],
    heatmap: cached.heatmap_data ?? [],
    top_sectors_by_nr: tc.top_sectors_by_nr ?? [],
    top_positions_by_nr: tc.top_positions_by_nr ?? [],
    position_table: cached.top_critical_groups ?? [],
    gender_distribution: dd.gender_distribution ?? {},
    age_distribution: dd.age_distribution ?? {},
    gender_risk: cached.scores_by_gender ?? [],
    age_risk: cached.scores_by_age ?? [],
    filter_context: { unit_id: null, sector_id: null, note: null },
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = apiLimiter(user.user_id);
    if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, company_id: true, status: true, name: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });

    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const unitId   = searchParams.get('unit_id');
    const sectorId = searchParams.get('sector_id');
    const isUnfiltered = !unitId && !sectorId;

    // ── Cache read ────────────────────────────────────────────────────────────
    // Only use cache for unfiltered requests; filters affect org-structure queries
    // that are not included in the cached payload.
    if (isUnfiltered) {
      const cached = await getCampaignMetricsWithCache(id, campaign.status);
      if (cached) return NextResponse.json(cached);
    }

    // ── Status guard ──────────────────────────────────────────────────────────
    if (campaign.status !== 'closed') {
      return NextResponse.json(
        { error: 'Dashboard disponível apenas para campanhas encerradas' },
        { status: 400 },
      );
    }

    // Fetch all responses
    const rawResponses = await prisma.surveyResponse.findMany({
      where: { campaign_id: id },
      select: { id: true, gender: true, age_range: true, responses: true, created_at: true },
    });

    const totalInvited = await prisma.surveyInvitation.count({ where: { campaign_id: id } });
    const totalResponded = rawResponses.length;
    const responseRate = totalInvited > 0 ? (totalResponded / totalInvited) * 100 : 0;

    if (totalResponded === 0) {
      return NextResponse.json({ error: 'Nenhuma resposta encontrada' }, { status: 404 });
    }

    const responses = rawResponses.map(r => ({
      ...r,
      responses: r.responses as Record<string, number>,
    }));

    // ── 1. DIMENSION SCORES & NR ─────────────────────────────────────────
    const dimensionAnalysis = HSE_DIMENSIONS.map(dim => {
      let total = 0;
      let count = 0;
      for (const resp of responses) {
        for (const qn of dim.questionNumbers) {
          const val = resp.responses[`q${qn}`];
          if (val !== undefined) { total += val; count++; }
        }
      }
      const avgScore = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
      const riskLevel = ScoreService.getRiskLevel(avgScore, dim.type);
      const nr = ScoreService.calculateNR(riskLevel);
      const { label, color } = ScoreService.interpretNR(nr);
      return {
        key: dim.key,
        name: dim.name,
        type: dim.type,
        avg_score: avgScore,
        risk_level: riskLevel,
        probability: { critico: 4, importante: 3, moderado: 2, aceitavel: 1 }[riskLevel],
        severity: { critico: 4, importante: 3, moderado: 2, aceitavel: 1 }[riskLevel],
        nr,
        nr_label: label,
        nr_color: color,
      };
    });

    // ── 2. IGRP ───────────────────────────────────────────────────────────
    const igrp = Math.round(
      dimensionAnalysis.reduce((sum, d) => sum + d.nr, 0) / dimensionAnalysis.length * 100,
    ) / 100;
    const igrpInterp = ScoreService.interpretNR(igrp);

    // ── 3. WORKERS AT HIGH RISK ───────────────────────────────────────────
    let workersHighRisk = 0;
    let workersCritical = 0;
    for (const resp of responses) {
      let maxNR = 0;
      for (const dim of HSE_DIMENSIONS) {
        const score = ScoreService.calculateDimensionScore(resp.responses, dim.key as DimensionType);
        const risk = ScoreService.getRiskLevel(score, dim.type);
        const nr = ScoreService.calculateNR(risk);
        if (nr > maxNR) maxNR = nr;
      }
      if (maxNR >= 9)  workersHighRisk++;
      if (maxNR >= 13) workersCritical++;
    }
    const workersHighRiskPct = Math.round((workersHighRisk / totalResponded) * 100);
    const workersCriticalPct = Math.round((workersCritical / totalResponded) * 100);

    // ── DEMOGRAPHIC RISK ANALYSIS ─────────────────────────────────────────────

    const GENDER_LABELS: Record<string, string> = {
      M: 'Masculino',
      F: 'Feminino',
      O: 'Outro',
      N: 'Nao informado',
    };

    const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

    const genderGroups: Record<string, {
      total: number;
      criticalDimensions: number;
      totalDimensions: number;
      byDimension: Record<string, { sum: number; count: number }>;
    }> = {};

    const ageGroups: Record<string, {
      total: number;
      criticalDimensions: number;
      totalDimensions: number;
      byDimension: Record<string, { sum: number; count: number }>;
    }> = {};

    for (const resp of responses) {
      const genderKey = GENDER_LABELS[resp.gender ?? 'N'] ?? 'Nao informado';
      const ageKey = resp.age_range ?? 'Nao informado';

      if (!genderGroups[genderKey]) {
        genderGroups[genderKey] = { total: 0, criticalDimensions: 0, totalDimensions: 0, byDimension: {} };
      }
      if (!ageGroups[ageKey]) {
        ageGroups[ageKey] = { total: 0, criticalDimensions: 0, totalDimensions: 0, byDimension: {} };
      }

      genderGroups[genderKey].total++;
      ageGroups[ageKey].total++;

      for (const dim of HSE_DIMENSIONS) {
        let total = 0;
        let count = 0;
        for (const qn of dim.questionNumbers) {
          const val = (resp.responses as Record<string, number>)[`q${qn}`];
          if (val !== undefined) { total += val; count++; }
        }
        if (count === 0) continue;

        const score = total / count;
        const riskLevel = ScoreService.getRiskLevel(score, dim.type);
        const nr = ScoreService.calculateNR(riskLevel);
        const isCritical = nr >= 9;

        if (!genderGroups[genderKey].byDimension[dim.key]) {
          genderGroups[genderKey].byDimension[dim.key] = { sum: 0, count: 0 };
        }
        genderGroups[genderKey].byDimension[dim.key].sum += nr;
        genderGroups[genderKey].byDimension[dim.key].count++;
        genderGroups[genderKey].totalDimensions++;
        if (isCritical) genderGroups[genderKey].criticalDimensions++;

        if (!ageGroups[ageKey].byDimension[dim.key]) {
          ageGroups[ageKey].byDimension[dim.key] = { sum: 0, count: 0 };
        }
        ageGroups[ageKey].byDimension[dim.key].sum += nr;
        ageGroups[ageKey].byDimension[dim.key].count++;
        ageGroups[ageKey].totalDimensions++;
        if (isCritical) ageGroups[ageKey].criticalDimensions++;
      }
    }

    const genderChartData = Object.entries(genderGroups)
      .filter(([, g]) => g.total >= 1)
      .map(([gender, g]) => {
        const criticalPct = g.totalDimensions > 0
          ? Math.round((g.criticalDimensions / g.totalDimensions) * 100)
          : 0;
        const worstDim = Object.entries(g.byDimension)
          .map(([key, d]) => ({
            key,
            name: HSE_DIMENSIONS.find(hd => hd.key === key)?.name ?? key,
            avgNR: d.count > 0 ? d.sum / d.count : 0,
          }))
          .sort((a, b) => b.avgNR - a.avgNR)[0];

        return {
          gender,
          total_responses: g.total,
          critical_pct: criticalPct,
          worst_dimension: worstDim?.name ?? null,
          worst_dimension_nr: worstDim ? Math.round(worstDim.avgNR * 10) / 10 : 0,
          suppressed: g.total < 5,
          dimensions: g.total < 5 ? null : Object.fromEntries(
            Object.entries(g.byDimension).map(([key, d]) => [
              key,
              d.count > 0 ? Math.round((d.sum / d.count) * 10) / 10 : 0,
            ]),
          ),
        };
      })
      .sort((a, b) => b.critical_pct - a.critical_pct);

    const ageChartData = Object.entries(ageGroups)
      .filter(([key]) => key !== 'Nao informado' || ageGroups[key].total > 0)
      .map(([ageRange, g]) => {
        const criticalPct = g.totalDimensions > 0
          ? Math.round((g.criticalDimensions / g.totalDimensions) * 100)
          : 0;
        const worstDim = Object.entries(g.byDimension)
          .map(([key, d]) => ({
            key,
            name: HSE_DIMENSIONS.find(hd => hd.key === key)?.name ?? key,
            avgNR: d.count > 0 ? d.sum / d.count : 0,
          }))
          .sort((a, b) => b.avgNR - a.avgNR)[0];

        return {
          age_range: ageRange,
          total_responses: g.total,
          critical_pct: criticalPct,
          worst_dimension: worstDim?.name ?? null,
          worst_dimension_nr: worstDim ? Math.round(worstDim.avgNR * 10) / 10 : 0,
          suppressed: g.total < 5,
          dimensions: g.total < 5 ? null : Object.fromEntries(
            Object.entries(g.byDimension).map(([key, d]) => [
              key,
              d.count > 0 ? Math.round((d.sum / d.count) * 10) / 10 : 0,
            ]),
          ),
        };
      })
      .sort((a, b) => {
        const ai = AGE_ORDER.indexOf(a.age_range);
        const bi = AGE_ORDER.indexOf(b.age_range);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

    // ── 4. STACKED BAR BY DIMENSION ──────────────────────────────────────
    const stackedByDimension = HSE_DIMENSIONS.map(dim => {
      const counts = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
      for (const resp of responses) {
        const score = ScoreService.calculateDimensionScore(resp.responses, dim.key as DimensionType);
        const risk = ScoreService.getRiskLevel(score, dim.type);
        counts[risk]++;
      }
      const total = totalResponded;
      return {
        dimension: dim.name,
        key: dim.key,
        aceitavel_pct: Math.round((counts.aceitavel / total) * 100),
        moderado_pct:  Math.round((counts.moderado  / total) * 100),
        importante_pct:Math.round((counts.importante/ total) * 100),
        critico_pct:   Math.round((counts.critico   / total) * 100),
        counts,
      };
    });

    // ── 5. STACKED BAR BY QUESTION ────────────────────────────────────────
    const stackedByQuestion = HSE_DIMENSIONS.flatMap(dim =>
      dim.questionNumbers.map(qn => {
        const counts = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
        for (const resp of responses) {
          const val = resp.responses[`q${qn}`] ?? 0;
          const risk = ScoreService.getRiskLevel(val, dim.type);
          counts[risk]++;
        }
        const total = totalResponded;
        return {
          question_number: qn,
          dimension: dim.name,
          dimension_key: dim.key,
          type: dim.type,
          aceitavel_pct: Math.round((counts.aceitavel / total) * 100),
          moderado_pct:  Math.round((counts.moderado  / total) * 100),
          importante_pct:Math.round((counts.importante/ total) * 100),
          critico_pct:   Math.round((counts.critico   / total) * 100),
        };
      }),
    ).sort((a, b) => a.question_number - b.question_number);

    // ── 6. HEATMAP ────────────────────────────────────────────────────────
    const units = await prisma.campaignUnit.findMany({
      where: {
        campaign_id: id,
        ...(unitId ? { id: unitId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const heatmapData = units.map(unit => ({
      unit: unit.name,
      dimensions: Object.fromEntries(
        dimensionAnalysis.map(d => [d.key, { nr: d.nr, color: d.nr_color, label: d.nr_label }]),
      ),
    }));

    // ── 7. TOP 5 SECTORS BY NR ────────────────────────────────────────────
    const sectors = await prisma.campaignSector.findMany({
      where: {
        unit: { campaign_id: id },
        ...(sectorId ? { id: sectorId } : unitId ? { unit_id: unitId } : {}),
      },
      select: { id: true, name: true, unit: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    const topSectorsByNR = sectors
      .map(sector => ({
        sector: sector.name,
        unit: sector.unit.name,
        nr: igrp,
        label: igrpInterp.label,
        color: igrpInterp.color,
      }))
      .sort((a, b) => b.nr - a.nr)
      .slice(0, 5);

    // ── 8. TOP 5 POSITIONS BY NR ──────────────────────────────────────────
    const positions = await prisma.campaignPosition.findMany({
      where: {
        sector: {
          unit: { campaign_id: id },
          ...(sectorId ? { id: sectorId } : unitId ? { unit_id: unitId } : {}),
        },
      },
      select: {
        id: true,
        name: true,
        sector: { select: { name: true, unit: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    const topPositionsByNR = positions
      .map(pos => ({
        position: pos.name,
        sector: pos.sector.name,
        unit: pos.sector.unit.name,
        nr: igrp,
        label: igrpInterp.label,
        color: igrpInterp.color,
      }))
      .sort((a, b) => b.nr - a.nr)
      .slice(0, 5);

    // ── 9. DEMOGRAPHIC DISTRIBUTIONS ─────────────────────────────────────
    const genderLabels: Record<string, string> = {
      M: 'Masculino', F: 'Feminino', O: 'Outro', N: 'Não informado',
    };
    const genderCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = {};

    for (const resp of responses) {
      const g = genderLabels[resp.gender ?? 'N'] ?? 'Não informado';
      const a = resp.age_range ?? 'Não informado';
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
      ageCounts[a] = (ageCounts[a] ?? 0) + 1;
    }

    // ── 10. DETAILED POSITION TABLE ───────────────────────────────────────
    const positionTable = positions.map(pos => {
      const nr = igrp;
      const { label } = ScoreService.interpretNR(nr);
      const scoreAsPct = Math.round((igrp / 16) * 100 * 10) / 10;
      return {
        position: pos.name,
        sector: pos.sector.name,
        unit: pos.sector.unit.name,
        score_pct: scoreAsPct,
        classification: label,
        nr,
        n_responses: totalResponded,
      };
    }).sort((a, b) => b.nr - a.nr);

    // ── Build response payload ─────────────────────────────────────────────
    const payload = {
      campaign_id: id,
      campaign_name: campaign.name,
      total_invited: totalInvited,
      total_responded: totalResponded,
      response_rate: Math.round(responseRate * 100) / 100,
      igrp,
      igrp_label: igrpInterp.label,
      igrp_color: igrpInterp.color,
      workers_high_risk_pct: workersHighRiskPct,
      workers_critical_pct: workersCriticalPct,
      dimension_analysis: dimensionAnalysis,
      stacked_by_dimension: stackedByDimension,
      stacked_by_question: stackedByQuestion,
      heatmap: heatmapData,
      top_sectors_by_nr: topSectorsByNR,
      top_positions_by_nr: topPositionsByNR,
      position_table: positionTable,
      gender_distribution: genderCounts,
      age_distribution: ageCounts,
      gender_risk: genderChartData,
      age_risk: ageChartData,
      filter_context: {
        unit_id: unitId ?? null,
        sector_id: sectorId ?? null,
        note: unitId || sectorId
          ? 'Scores refletem toda a campanha (anonimato). Hierarquia filtrada por unidade/setor.'
          : null,
      },
    };

    // ── Cache write (unfiltered closed campaigns only) ─────────────────────
    if (isUnfiltered) {
      const now = new Date();
      await prisma.campaignMetrics.upsert({
        where: { campaign_id: id },
        create: {
          campaign_id: id,
          total_invited: totalInvited,
          total_responded: totalResponded,
          response_rate: payload.response_rate,
          igrp,
          dimension_scores: dimensionAnalysis,
          risk_distribution: {
            campaign_name: campaign.name,
            igrp_label: igrpInterp.label,
            igrp_color: igrpInterp.color,
            workers_high_risk_pct: workersHighRiskPct,
            workers_critical_pct: workersCriticalPct,
            stacked_by_dimension: stackedByDimension,
            stacked_by_question: stackedByQuestion,
          },
          demographic_data: {
            gender_distribution: genderCounts,
            age_distribution: ageCounts,
          },
          heatmap_data: heatmapData,
          top_critical_sectors: {
            top_sectors_by_nr: topSectorsByNR,
            top_positions_by_nr: topPositionsByNR,
          },
          scores_by_gender: genderChartData,
          scores_by_age: ageChartData,
          top_critical_groups: positionTable,
          calculated_at: now,
          updated_at: now,
        },
        update: {
          total_invited: totalInvited,
          total_responded: totalResponded,
          response_rate: payload.response_rate,
          igrp,
          dimension_scores: dimensionAnalysis,
          risk_distribution: {
            campaign_name: campaign.name,
            igrp_label: igrpInterp.label,
            igrp_color: igrpInterp.color,
            workers_high_risk_pct: workersHighRiskPct,
            workers_critical_pct: workersCriticalPct,
            stacked_by_dimension: stackedByDimension,
            stacked_by_question: stackedByQuestion,
          },
          demographic_data: {
            gender_distribution: genderCounts,
            age_distribution: ageCounts,
          },
          heatmap_data: heatmapData,
          top_critical_sectors: {
            top_sectors_by_nr: topSectorsByNR,
            top_positions_by_nr: topPositionsByNR,
          },
          scores_by_gender: genderChartData,
          scores_by_age: ageChartData,
          top_critical_groups: positionTable,
          updated_at: now,
        },
      });
    }

    return NextResponse.json(payload);

  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
