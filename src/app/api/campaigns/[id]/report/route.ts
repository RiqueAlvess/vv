import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import {
  HSE_DIMENSIONS,
  RISK_THRESHOLDS_NEGATIVE,
  RISK_THRESHOLDS_POSITIVE,
  NR_MATRIX,
} from '@/lib/constants';
import type { RiskLevel } from '@/types';

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

/**
 * Computes campaign-wide dimension scores from an array of survey response answer maps.
 * Iterates over all responses once per dimension — O(responses × questions_total).
 * Returns an empty object when the responses array is empty.
 */
export function computeDimensions(
  responses: Record<string, number>[]
): Record<string, { score: number; risk: RiskLevel; nr: number }> {
  if (responses.length === 0) return {};

  const result: Record<string, { score: number; risk: RiskLevel; nr: number }> = {};

  for (const dim of HSE_DIMENSIONS) {
    let totalScore = 0;
    let count = 0;

    for (const response of responses) {
      for (const qn of dim.questionNumbers) {
        const key = `q${qn}`;
        if (response[key] !== undefined) {
          totalScore += response[key];
          count++;
        }
      }
    }

    const avg = count > 0 ? totalScore / count : 0;
    const roundedAvg = Math.round(avg * 100) / 100;
    const risk = getRiskLevel(roundedAvg, dim.type);
    const nr = calculateNR(risk);

    result[dim.key] = { score: roundedAvg, risk, nr };
  }

  return result;
}

interface PositionReport {
  name: string;
  dimensions: Record<string, { score: number; risk: RiskLevel; nr: number }>;
}

interface SectorReport {
  name: string;
  positions: PositionReport[];
}

interface UnitReport {
  name: string;
  sectors: SectorReport[];
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, company_id: true, status: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (campaign.status !== 'closed') {
      return NextResponse.json(
        { error: 'Relatório disponível apenas para campanhas encerradas' },
        { status: 400 }
      );
    }

    // Query 1: full hierarchy in one shot — units → sectors → positions → employees
    const units = await prisma.campaignUnit.findMany({
      where: { campaign_id: id },
      orderBy: { name: 'asc' },
      include: {
        sectors: {
          orderBy: { name: 'asc' },
          include: {
            positions: {
              orderBy: { name: 'asc' },
              include: {
                employees: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma unidade encontrada na campanha' },
        { status: 404 }
      );
    }

    // Query 2: all responses in one shot — only the answers JSON is needed
    const allResponses = await prisma.surveyResponse.findMany({
      where: { campaign_id: id },
      select: { responses: true },
    });

    if (!allResponses || allResponses.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma resposta encontrada' },
        { status: 404 }
      );
    }

    // Pre-compute campaign-wide dimension scores once from all responses.
    // SurveyResponse has no FK to positions (Blind-Drop anonymity guarantee),
    // so the same aggregate scores apply to every position that has employees.
    const campaignDimensions = computeDimensions(
      allResponses.map((r) => r.responses as Record<string, number>)
    );

    // Traverse hierarchy in memory — zero additional DB calls
    const unitReports: UnitReport[] = units.map((unit) => ({
      name: unit.name,
      sectors: unit.sectors.map((sector) => ({
        name: sector.name,
        positions: sector.positions.map((position) => ({
          name: position.name,
          // Positions with no employees get empty dimensions (no respondents possible)
          dimensions: position.employees.length > 0 ? campaignDimensions : {},
        })),
      })),
    }));

    return NextResponse.json({ units: unitReports });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
