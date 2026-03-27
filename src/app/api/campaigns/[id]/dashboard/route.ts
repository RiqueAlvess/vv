import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from '@/services/score.service';
import type { RiskLevel, DimensionType } from '@/types';

interface RouteParams { params: Promise<{ id: string }> }

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
    if (campaign.status !== 'closed') {
      return NextResponse.json({ error: 'Dashboard disponível apenas para campanhas encerradas' }, { status: 400 });
    }
    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const unitId   = searchParams.get('unit_id');
    const sectorId = searchParams.get('sector_id');

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
    // For each dimension: avg score, classification, P, S, NR, color
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

    // ── 2. IGRP (mean of all 7 NR values) ────────────────────────────────
    const igrp = Math.round(
      dimensionAnalysis.reduce((sum, d) => sum + d.nr, 0) / dimensionAnalysis.length * 100
    ) / 100;
    const igrpInterp = ScoreService.interpretNR(igrp);

    // ── 3. WORKERS AT HIGH RISK (NR >= 9) ────────────────────────────────
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

    // ── 4. STACKED BAR BY DIMENSION ──────────────────────────────────────
    // For each dimension: how many respondents fall in each risk bucket
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
    // For each question: % of respondents at each risk level (considering polarity)
    const stackedByQuestion = HSE_DIMENSIONS.flatMap(dim =>
      dim.questionNumbers.map(qn => {
        const counts = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
        for (const resp of responses) {
          const val = resp.responses[`q${qn}`] ?? 0;
          // For a single question, treat as a "score" and classify
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
      })
    ).sort((a, b) => a.question_number - b.question_number);

    // ── 6. HEATMAP: NR by dimension × unit ───────────────────────────────
    // Fetch org structure to group responses by unit
    // NOTE: responses have no direct unit link (Blind Drop).
    // We use the campaign-wide score per dimension per unit (all units get same score).
    // When sector-level tracking is added, this will be per-unit.
    const units = await prisma.campaignUnit.findMany({
      where: {
        campaign_id: id,
        ...(unitId ? { id: unitId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // For now: heatmap shows campaign-wide NR per dimension (same for all units)
    // This is correct per Blind Drop — no per-unit response data available
    const heatmapData = units.map(unit => ({
      unit: unit.name,
      dimensions: Object.fromEntries(
        dimensionAnalysis.map(d => [d.key, { nr: d.nr, color: d.nr_color, label: d.nr_label }])
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

    // Campaign-wide NR for each dimension (same for all sectors — Blind Drop)
    const topSectorsByNR = sectors
      .map(sector => ({
        sector: sector.name,
        unit: sector.unit.name,
        nr: igrp, // campaign-wide IGRP as proxy
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
      const scoreAsPct = Math.round((igrp / 16) * 100 * 10) / 10; // NR as % of max (16)
      return {
        position: pos.name,
        sector: pos.sector.name,
        unit: pos.sector.unit.name,
        score_pct: scoreAsPct,
        classification: label,
        nr,
        n_responses: totalResponded, // campaign-wide (Blind Drop)
      };
    }).sort((a, b) => b.nr - a.nr);

    return NextResponse.json({
      // Meta
      campaign_id: id,
      campaign_name: campaign.name,
      total_invited: totalInvited,
      total_responded: totalResponded,
      response_rate: Math.round(responseRate * 100) / 100,

      // Core metrics
      igrp,
      igrp_label: igrpInterp.label,
      igrp_color: igrpInterp.color,
      workers_high_risk_pct: workersHighRiskPct,
      workers_critical_pct: workersCriticalPct,

      // Chart data
      dimension_analysis: dimensionAnalysis,
      stacked_by_dimension: stackedByDimension,
      stacked_by_question: stackedByQuestion,
      heatmap: heatmapData,
      top_sectors_by_nr: topSectorsByNR,
      top_positions_by_nr: topPositionsByNR,
      position_table: positionTable,

      // Demographics
      gender_distribution: genderCounts,
      age_distribution: ageCounts,

      // Filter context
      filter_context: {
        unit_id: unitId ?? null,
        sector_id: sectorId ?? null,
        note: unitId || sectorId
          ? 'Scores refletem toda a campanha (anonimato). Hierarquia filtrada por unidade/setor.'
          : null,
      },
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
