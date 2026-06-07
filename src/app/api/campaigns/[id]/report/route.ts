import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { computeDimensions } from '@/lib/report-helpers';
import type { RiskLevel } from '@/types';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SectorReport {
  name: string;
  unit: string;
  n_responses: number;
  dimensions: Record<string, { score: number; risk: RiskLevel; nr: number }>;
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

    if (user.role !== 'ADM' && user.role !== 'RH' && user.role !== 'MEDICO') {
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
    if (user.role === 'MEDICO' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (campaign.status !== 'closed') {
      return NextResponse.json(
        { error: 'Relatório disponível apenas para campanhas encerradas' },
        { status: 400 }
      );
    }

    const SECTOR_PRIVACY_MIN = 2;

    // Query hierarchy: units → sectors (GHE)
    const units = await prisma.campaignUnit.findMany({
      where: { campaign_id: id },
      orderBy: { name: 'asc' },
      include: {
        sectors: {
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { responses: true } },
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

    // All responses with sector info
    const allResponses = await prisma.surveyResponse.findMany({
      where: { campaign_id: id },
      select: { responses: true, sector_id: true },
    });

    if (!allResponses || allResponses.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma resposta encontrada' },
        { status: 404 }
      );
    }

    // Pre-compute campaign-wide dimensions as fallback
    const campaignDimensions = computeDimensions(
      allResponses.map((r) => r.responses as Record<string, number>)
    );

    // Build sector-level reports grouped by unit
    const unitReports: UnitReport[] = units.map((unit) => ({
      name: unit.name,
      sectors: unit.sectors
        .map((sector) => {
          const sectorResponses = allResponses.filter(
            (r) => r.sector_id === sector.id
          );
          const n = sectorResponses.length;
          if (n < SECTOR_PRIVACY_MIN) return null;

          const dimensions = computeDimensions(
            sectorResponses.map((r) => r.responses as Record<string, number>)
          );

          return {
            name: sector.name,
            unit: unit.name,
            n_responses: n,
            dimensions: n > 0 ? dimensions : campaignDimensions,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null),
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
