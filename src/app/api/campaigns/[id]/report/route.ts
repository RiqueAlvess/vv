import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
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

    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (campaign.status !== 'closed') {
      return NextResponse.json(
        { error: 'Relatório disponível apenas para campanhas encerradas' },
        { status: 400 }
      );
    }

    // Get campaign hierarchy
    const { data: units } = await supabase
      .from('core.campaign_units')
      .select('id, name')
      .eq('campaign_id', id)
      .order('name');

    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma unidade encontrada na campanha' },
        { status: 404 }
      );
    }

    // Get all responses for this campaign
    const { data: allResponses } = await supabase
      .from('core.survey_responses')
      .select('*')
      .eq('campaign_id', id);

    if (!allResponses || allResponses.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma resposta encontrada' },
        { status: 404 }
      );
    }

    // Build the response-to-employee mapping through invitations
    // Note: responses are anonymized, so we map through session-level data
    // For PGR report we calculate dimension scores per position using all responses

    const unitReports: UnitReport[] = [];

    for (const unit of units) {
      const { data: sectors } = await supabase
        .from('core.campaign_sectors')
        .select('id, name')
        .eq('unit_id', unit.id)
        .order('name');

      const sectorReports: SectorReport[] = [];

      for (const sector of (sectors ?? [])) {
        const { data: positions } = await supabase
          .from('core.campaign_positions')
          .select('id, name')
          .eq('sector_id', sector.id)
          .order('name');

        const positionReports: PositionReport[] = [];

        for (const position of (positions ?? [])) {
          // Get employees for this position
          const { data: employees } = await supabase
            .from('core.campaign_employees')
            .select('id')
            .eq('position_id', position.id);

          const employeeIds = employees?.map((e: { id: string }) => e.id) ?? [];

          if (employeeIds.length === 0) {
            positionReports.push({
              name: position.name,
              dimensions: {},
            });
            continue;
          }

          // Get invitations for these employees
          const { data: invitations } = await supabase
            .from('core.survey_invitations')
            .select('id, employee_id')
            .eq('campaign_id', id)
            .in('employee_id', employeeIds);

          // Since responses are anonymized (no direct link to invitation),
          // we calculate scores across all campaign responses for this position
          // In a real system, responses would be linked through session tracking
          const dimensions: Record<string, { score: number; risk: RiskLevel; nr: number }> = {};

          // Calculate dimension scores from all responses proportionally
          const positionResponseCount = invitations?.length ?? 0;

          if (positionResponseCount > 0 && allResponses.length > 0) {
            for (const dim of HSE_DIMENSIONS) {
              let totalScore = 0;
              let count = 0;

              for (const response of allResponses) {
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
              const roundedAvg = Math.round(avg * 100) / 100;
              const risk = getRiskLevel(roundedAvg, dim.type);
              const nr = calculateNR(risk);

              dimensions[dim.key] = {
                score: roundedAvg,
                risk,
                nr,
              };
            }
          }

          positionReports.push({
            name: position.name,
            dimensions,
          });
        }

        sectorReports.push({
          name: sector.name,
          positions: positionReports,
        });
      }

      unitReports.push({
        name: unit.name,
        sectors: sectorReports,
      });
    }

    return NextResponse.json({ units: unitReports });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
