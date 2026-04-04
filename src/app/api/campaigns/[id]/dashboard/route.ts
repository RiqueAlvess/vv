import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { AGE_RANGES, HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from '@/services/score.service';
import { DASHBOARD_CACHE_VERSION, getCampaignMetricsWithCache } from '@/lib/dashboard-cache';
import type { DimensionType, RiskLevel } from '@/types';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

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

type ParsedResponse = {
  id: string;
  gender: string | null;
  age_range: string | null;
  unit_id: string | null;
  sector_id: string | null;
  position_id: string | null;
  responses: Record<string, number>;
};

function toParsedResponse(resp: {
  id: string;
  gender: string | null;
  age_range: string | null;
  unit_id: string | null;
  sector_id: string | null;
  position_id: string | null;
  responses: unknown;
}): ParsedResponse {
  return {
    ...resp,
    responses: (resp.responses ?? {}) as Record<string, number>,
  };
}

function getResponseDimensionRisk(response: ParsedResponse, dimension: typeof HSE_DIMENSIONS[number]) {
  const score = ScoreService.calculateDimensionScore(response.responses, dimension.key as DimensionType);
  const riskLevel = ScoreService.getRiskLevel(score, dimension.type);
  const nr = ScoreService.calculateNR(riskLevel);
  return { score, riskLevel, nr };
}

function aggregateDimensionAnalysis(responses: ParsedResponse[]) {
  return HSE_DIMENSIONS.map((dim) => {
    let scoreSum = 0;
    let scoreCount = 0;
    const riskCount = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 } satisfies Record<RiskLevel, number>;

    for (const resp of responses) {
      const { score, riskLevel } = getResponseDimensionRisk(resp, dim);
      if (!Number.isFinite(score)) continue;
      scoreSum += score;
      scoreCount++;
      riskCount[riskLevel]++;
    }

    const avgScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0;
    const dominantRisk = (Object.entries(riskCount) as Array<[RiskLevel, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'aceitavel';
    const nr = ScoreService.calculateNR(dominantRisk);
    const interp = ScoreService.interpretNR(nr);

    return {
      key: dim.key,
      name: dim.name,
      type: dim.type,
      avg_score: avgScore,
      risk_level: dominantRisk,
      probability: RISK_LEVEL_WEIGHT[dominantRisk],
      severity: RISK_LEVEL_WEIGHT[dominantRisk],
      nr,
      nr_label: interp.label,
      nr_color: interp.color,
      sample_size: scoreCount,
    };
  });
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
    const unitId = searchParams.get('unit_id');
    const sectorId = searchParams.get('sector_id');
    const isUnfiltered = !unitId && !sectorId;

    if (isUnfiltered) {
      const cached = await getCampaignMetricsWithCache(id, campaign.status);
      if (cached) return NextResponse.json(cached);
    }

    if (campaign.status !== 'closed') {
      return NextResponse.json(
        { error: 'Dashboard disponível apenas para campanhas encerradas' },
        { status: 400 },
      );
    }

    const rawResponses = await prisma.surveyResponse.findMany({
      where: {
        campaign_id: id,
        ...(unitId ? { unit_id: unitId } : {}),
        ...(sectorId ? { sector_id: sectorId } : {}),
      },
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

    const totalInvited = 0;
    const totalResponded = rawResponses.length;
    const responseRate = totalInvited > 0 ? (totalResponded / totalInvited) * 100 : 0;

    if (totalResponded === 0) {
      return NextResponse.json({ error: 'Nenhuma resposta encontrada' }, { status: 404 });
    }

    const responses = rawResponses.map(toParsedResponse);

    const dimensionAnalysis = aggregateDimensionAnalysis(responses);

    const igrp = Number((dimensionAnalysis.reduce((sum, d) => sum + d.nr, 0) / dimensionAnalysis.length).toFixed(2));
    const igrpInterp = ScoreService.interpretNR(igrp);

    let workersHighRisk = 0;
    let workersCritical = 0;
    for (const resp of responses) {
      let maxNR = 0;
      for (const dim of HSE_DIMENSIONS) {
        const { nr } = getResponseDimensionRisk(resp, dim);
        if (nr > maxNR) maxNR = nr;
      }
      if (maxNR >= 9) workersHighRisk++;
      if (maxNR >= 13) workersCritical++;
    }
    const workersHighRiskPct = Math.round((workersHighRisk / totalResponded) * 100);
    const workersCriticalPct = Math.round((workersCritical / totalResponded) * 100);

    const genderGroups: Record<string, {
      total: number;
      highRiskRespondents: number;
      byDimension: Record<string, { nrSum: number; count: number }>;
    }> = {};

    const ageGroups: Record<string, {
      total: number;
      highRiskRespondents: number;
      byDimension: Record<string, { nrSum: number; count: number }>;
    }> = {};

    for (const resp of responses) {
      const genderKey = GENDER_LABELS[resp.gender ?? 'N'] ?? 'Não informado';
      const ageKey = resp.age_range && AGE_RANGES.includes(resp.age_range) ? resp.age_range : 'Não informado';

      if (!genderGroups[genderKey]) {
        genderGroups[genderKey] = { total: 0, highRiskRespondents: 0, byDimension: {} };
      }
      if (!ageGroups[ageKey]) {
        ageGroups[ageKey] = { total: 0, highRiskRespondents: 0, byDimension: {} };
      }

      genderGroups[genderKey].total++;
      ageGroups[ageKey].total++;

      let hasHighRiskDimension = false;

      for (const dim of HSE_DIMENSIONS) {
        const { nr } = getResponseDimensionRisk(resp, dim);
        if (nr >= 9) hasHighRiskDimension = true;

        if (!genderGroups[genderKey].byDimension[dim.key]) {
          genderGroups[genderKey].byDimension[dim.key] = { nrSum: 0, count: 0 };
        }
        genderGroups[genderKey].byDimension[dim.key].nrSum += nr;
        genderGroups[genderKey].byDimension[dim.key].count += 1;

        if (!ageGroups[ageKey].byDimension[dim.key]) {
          ageGroups[ageKey].byDimension[dim.key] = { nrSum: 0, count: 0 };
        }
        ageGroups[ageKey].byDimension[dim.key].nrSum += nr;
        ageGroups[ageKey].byDimension[dim.key].count += 1;
      }

      if (hasHighRiskDimension) {
        genderGroups[genderKey].highRiskRespondents += 1;
        ageGroups[ageKey].highRiskRespondents += 1;
      }
    }

    const genderChartData = Object.entries(genderGroups)
      .filter(([, g]) => g.total > 0)
      .map(([gender, g]) => {
        const criticalPct = Math.round((g.highRiskRespondents / g.total) * 100);
        const worstDim = Object.entries(g.byDimension)
          .map(([key, d]) => ({
            key,
            name: HSE_DIMENSIONS.find((hd) => hd.key === key)?.name ?? key,
            avgNR: d.count > 0 ? d.nrSum / d.count : 0,
          }))
          .sort((a, b) => b.avgNR - a.avgNR)[0];

        return {
          gender,
          total_responses: g.total,
          critical_pct: criticalPct,
          worst_dimension: worstDim?.name ?? null,
          worst_dimension_nr: worstDim ? Number(worstDim.avgNR.toFixed(1)) : 0,
          suppressed: false,
          dimensions: Object.fromEntries(
            Object.entries(g.byDimension).map(([key, d]) => [key, d.count > 0 ? Number((d.nrSum / d.count).toFixed(1)) : 0]),
          ),
        };
      })
      .sort((a, b) => b.critical_pct - a.critical_pct);

    const ageChartData = Object.entries(ageGroups)
      .filter(([, g]) => g.total > 0)
      .map(([ageRange, g]) => {
        const criticalPct = Math.round((g.highRiskRespondents / g.total) * 100);
        const worstDim = Object.entries(g.byDimension)
          .map(([key, d]) => ({
            key,
            name: HSE_DIMENSIONS.find((hd) => hd.key === key)?.name ?? key,
            avgNR: d.count > 0 ? d.nrSum / d.count : 0,
          }))
          .sort((a, b) => b.avgNR - a.avgNR)[0];

        return {
          age_range: ageRange,
          total_responses: g.total,
          critical_pct: criticalPct,
          worst_dimension: worstDim?.name ?? null,
          worst_dimension_nr: worstDim ? Number(worstDim.avgNR.toFixed(1)) : 0,
          suppressed: false,
          dimensions: Object.fromEntries(
            Object.entries(g.byDimension).map(([key, d]) => [key, d.count > 0 ? Number((d.nrSum / d.count).toFixed(1)) : 0]),
          ),
        };
      })
      .sort((a, b) => {
        const ai = AGE_RANGES.indexOf(a.age_range);
        const bi = AGE_RANGES.indexOf(b.age_range);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

    const stackedByDimension = HSE_DIMENSIONS.map((dim) => {
      const counts: Record<RiskLevel, number> = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
      for (const resp of responses) {
        const { riskLevel } = getResponseDimensionRisk(resp, dim);
        counts[riskLevel]++;
      }

      const total = totalResponded;
      return {
        dimension: dim.name,
        key: dim.key,
        aceitavel_pct: Math.round((counts.aceitavel / total) * 100),
        moderado_pct: Math.round((counts.moderado / total) * 100),
        importante_pct: Math.round((counts.importante / total) * 100),
        critico_pct: Math.round((counts.critico / total) * 100),
        counts,
      };
    });

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

    const units = await prisma.campaignUnit.findMany({
      where: {
        campaign_id: id,
        ...(unitId ? { id: unitId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const heatmapData = units.map((unit) => {
      const unitResponses = responses.filter((resp) => resp.unit_id === unit.id);
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
            const avgScore = unitResponses.reduce((sum, resp) => sum + ScoreService.calculateDimensionScore(resp.responses, dim.key as DimensionType), 0) / unitResponses.length;
            const risk = ScoreService.getRiskLevel(avgScore, dim.type);
            const nr = ScoreService.calculateNR(risk);
            const { label, color } = ScoreService.interpretNR(nr);
            return [dim.key, { nr, color, label }];
          }),
        ),
      };
    });

    const sectors = await prisma.campaignSector.findMany({
      where: {
        unit: { campaign_id: id },
        ...(sectorId ? { id: sectorId } : unitId ? { unit_id: unitId } : {}),
      },
      select: { id: true, name: true, unit: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    const topSectorsByNR = sectors
      .map((sector) => {
        const sectorResponses = responses.filter((resp) => resp.sector_id === sector.id);
        if (sectorResponses.length === 0) {
          return {
            sector: sector.name,
            unit: sector.unit.name,
            nr: 0,
            label: 'Sem dados',
            color: '#CBD5E1',
          };
        }

        const sectorDimensionAnalysis = aggregateDimensionAnalysis(sectorResponses);
        const sectorNR = Number((sectorDimensionAnalysis.reduce((sum, d) => sum + d.nr, 0) / sectorDimensionAnalysis.length).toFixed(2));
        const interp = ScoreService.interpretNR(sectorNR);

        return {
          sector: sector.name,
          unit: sector.unit.name,
          nr: sectorNR,
          label: interp.label,
          color: interp.color,
        };
      })
      .sort((a, b) => b.nr - a.nr)
      .slice(0, 5);

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
        sector: { select: { id: true, name: true, unit: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    const positionTable = positions
      .map((pos) => {
        const positionResponses = responses.filter((resp) => resp.position_id === pos.id);
        if (positionResponses.length === 0) {
          return null;
        }

        const posDimensions = aggregateDimensionAnalysis(positionResponses);
        const posNR = Number((posDimensions.reduce((sum, d) => sum + d.nr, 0) / posDimensions.length).toFixed(1));
        const { label } = ScoreService.interpretNR(posNR);
        const scoreAsPct = Number(((posNR / 16) * 100).toFixed(1));

        return {
          position: pos.name,
          sector: pos.sector.name,
          unit: pos.sector.unit.name,
          score_pct: scoreAsPct,
          classification: label,
          nr: posNR,
          n_responses: positionResponses.length,
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

    const genderCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = {};

    for (const resp of responses) {
      const g = GENDER_LABELS[resp.gender ?? 'N'] ?? 'Não informado';
      const a = resp.age_range && AGE_RANGES.includes(resp.age_range) ? resp.age_range : 'Não informado';
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
      ageCounts[a] = (ageCounts[a] ?? 0) + 1;
    }

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
          ? 'Métricas recalculadas com base nos filtros ativos de unidade/setor.'
          : null,
      },
    };

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
            payload_version: DASHBOARD_CACHE_VERSION,
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
            payload_version: DASHBOARD_CACHE_VERSION,
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