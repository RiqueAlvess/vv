import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { computeDimensions } from '@/lib/report-helpers';
import type { RiskLevel } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
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
