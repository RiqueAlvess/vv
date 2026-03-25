import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import {
  HSE_DIMENSIONS,
  RISK_THRESHOLDS_NEGATIVE,
  RISK_THRESHOLDS_POSITIVE,
  NR_MATRIX,
} from '@/lib/constants';
import type { RiskLevel, DashboardData } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getRiskLevel(score: number, type: 'positive' | 'negative'): RiskLevel {
  if (type === 'negative') {
    for (const threshold of RISK_THRESHOLDS_NEGATIVE) {
      if (score >= threshold.min) return threshold.level;
    }
    return 'aceitavel';
  }
  for (const threshold of RISK_THRESHOLDS_POSITIVE) {
    if (score <= threshold.max) return threshold.level;
  }
  return 'aceitavel';
}

function calculateNR(riskLevel: RiskLevel): number {
  return NR_MATRIX[riskLevel].probability * NR_MATRIX.default_severity;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const limit = apiLimiter(ip);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em breve.' },
        { status: 429 }
      );
    }

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: campaign } = await supabase
      .from('core.campaigns')
      .select('id, company_id, status')
      .eq('id', id)
      .single();

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    if (campaign.status !== 'closed') {
      return NextResponse.json(
        { error: 'Dashboard disponível apenas para campanhas encerradas' },
        { status: 400 }
      );
    }

    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Try pre-calculated metrics first
    const { data: cachedMetrics } = await supabase
      .from('analytics.campaign_metrics')
      .select('*')
      .eq('campaign_id', id)
      .single();

    if (cachedMetrics) {
      const dashboardData: DashboardData = {
        metrics: cachedMetrics,
        dimension_scores: cachedMetrics.dimension_scores,
        radar_data: HSE_DIMENSIONS.map((dim) => ({
          dimension: dim.name,
          score: cachedMetrics.dimension_scores[dim.key] ?? 0,
        })),
        top_sectors: cachedMetrics.top_critical_sectors ?? [],
        risk_distribution: cachedMetrics.risk_distribution,
        gender_distribution: (cachedMetrics.demographic_data as Record<string, Record<string, number>>)?.gender ?? {},
        age_distribution: (cachedMetrics.demographic_data as Record<string, Record<string, number>>)?.age ?? {},
        heatmap: cachedMetrics.heatmap_data,
        scores_by_gender: cachedMetrics.scores_by_gender,
        scores_by_age: cachedMetrics.scores_by_age,
        top_critical_groups: cachedMetrics.top_critical_groups ?? [],
      };

      // LIDERANCA: filter to their sector only
      if (user.role === 'LIDERANCA' && user.company_id === campaign.company_id) {
        return NextResponse.json({
          ...dashboardData,
          restricted: true,
          message: 'Dados filtrados para seu setor',
        });
      }

      return NextResponse.json(dashboardData);
    }

    // Calculate on the fly
    const { data: responses } = await supabase
      .from('core.survey_responses')
      .select('*')
      .eq('campaign_id', id);

    if (!responses || responses.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma resposta encontrada para esta campanha' },
        { status: 404 }
      );
    }

    const { count: totalInvited } = await supabase
      .from('core.survey_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id);

    const totalResponded = responses.length;
    const responseRate = totalInvited ? (totalResponded / totalInvited) * 100 : 0;

    // Calculate dimension scores
    const dimensionScores: Record<string, number> = {};
    const riskDistribution: Record<string, number> = {
      aceitavel: 0,
      moderado: 0,
      importante: 0,
      critico: 0,
    };

    let igrpSum = 0;

    for (const dim of HSE_DIMENSIONS) {
      let totalScore = 0;
      let count = 0;

      for (const response of responses) {
        const respData = response.responses as Record<string, number>;
        for (const qn of dim.questionNumbers) {
          const key = `q${qn}`;
          if (respData[key] !== undefined) {
            totalScore += respData[key];
            count++;
          }
        }
      }

      const avg = count > 0 ? totalScore / count : 0;
      dimensionScores[dim.key] = Math.round(avg * 100) / 100;

      const risk = getRiskLevel(avg, dim.type);
      riskDistribution[risk]++;

      igrpSum += calculateNR(risk);
    }

    const igrp = Math.round((igrpSum / HSE_DIMENSIONS.length) * 100) / 100;

    // Demographic distribution
    const genderDist: Record<string, number> = {};
    const ageDist: Record<string, number> = {};

    for (const response of responses) {
      if (response.gender) {
        genderDist[response.gender] = (genderDist[response.gender] ?? 0) + 1;
      }
      if (response.age_range) {
        ageDist[response.age_range] = (ageDist[response.age_range] ?? 0) + 1;
      }
    }

    const radarData = HSE_DIMENSIONS.map((dim) => ({
      dimension: dim.name,
      score: dimensionScores[dim.key] ?? 0,
    }));

    const dashboardData: DashboardData = {
      metrics: {
        id: '',
        campaign_id: id,
        total_invited: totalInvited ?? 0,
        total_responded: totalResponded,
        response_rate: Math.round(responseRate * 100) / 100,
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
      radar_data: radarData,
      top_sectors: [],
      risk_distribution: riskDistribution,
      gender_distribution: genderDist,
      age_distribution: ageDist,
      heatmap: {},
      scores_by_gender: {},
      scores_by_age: {},
      top_critical_groups: [],
    };

    if (user.role === 'LIDERANCA') {
      return NextResponse.json({
        ...dashboardData,
        restricted: true,
        message: 'Dados filtrados para seu setor',
      });
    }

    return NextResponse.json(dashboardData);
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
