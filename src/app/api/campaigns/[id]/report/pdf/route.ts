import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from '@/services/score.service';
import type { RiskLevel } from '@/types';

interface RouteParams { params: Promise<{ id: string }> }

function buildPGRHtml(params: {
  companyName: string;
  cnpj: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalResponded: number;
  totalInvited: number;
  units: Array<{
    name: string;
    sectors: Array<{
      name: string;
      positions: Array<{
        name: string;
        dimensions: Record<string, {
          score: number; riskLevel: string; probability: number;
          severity: number; nr: number; nrLabel: string; color: string;
        }>;
      }>;
    }>;
  }>;
  campaignDimensions: Array<{
    key: string; name: string; score: number; riskLevel: string;
    probability: number; severity: number; nr: number; nrLabel: string; color: string;
  }>;
}): string {
  const MIN_RESPONDENTS = 5;

  const dimRows = params.campaignDimensions.map(d => `
    <tr>
      <td>${d.name}</td>
      <td style="text-align:center">${d.score.toFixed(2)}</td>
      <td style="text-align:center">${d.riskLevel === 'critico' ? 'ALTO RISCO' : d.riskLevel === 'importante' ? 'Risco Moderado' : d.riskLevel === 'moderado' ? 'Risco Médio' : 'Baixo Risco'}</td>
      <td style="text-align:center">${d.probability}</td>
      <td style="text-align:center">${d.severity}</td>
      <td style="text-align:center; font-weight:600">${d.nr}</td>
      <td style="text-align:center; color:${d.color}; font-weight:600">${d.nrLabel}</td>
    </tr>
  `).join('');

  const hierarchyHtml = params.units.map(unit => `
    <div class="unit">
      <div class="unit-header">UNIDADE: ${unit.name.toUpperCase()}</div>
      ${unit.sectors.map(sector => `
        <div class="sector">
          <div class="sector-header">Setor: ${sector.name}</div>
          ${sector.positions.map(position => {
            const hasDims = Object.keys(position.dimensions).length > 0;
            if (!hasDims || params.totalResponded < MIN_RESPONDENTS) {
              return `
                <div class="position">
                  <div class="position-header">Cargo: ${position.name}</div>
                  <div class="suppressed">Dados suprimidos — menos de ${MIN_RESPONDENTS} respondentes (proteção de anonimato LGPD)</div>
                </div>`;
            }
            return `
              <div class="position">
                <div class="position-header">Cargo: ${position.name}</div>
                <table class="dim-table">
                  <thead>
                    <tr>
                      <th>Dimensão</th>
                      <th>Score</th>
                      <th>Classificação</th>
                      <th>P</th>
                      <th>S</th>
                      <th>NR = P×S</th>
                      <th>Nível Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.entries(position.dimensions).map(([key, d]) => `
                      <tr>
                        <td>${params.campaignDimensions.find(cd => cd.key === key)?.name ?? key}</td>
                        <td style="text-align:center">${d.score.toFixed(2)}</td>
                        <td style="text-align:center">${
                          d.riskLevel === 'critico' ? 'ALTO RISCO' :
                          d.riskLevel === 'importante' ? 'Risco Moderado' :
                          d.riskLevel === 'moderado' ? 'Risco Médio' : 'Baixo Risco'
                        }</td>
                        <td style="text-align:center">${d.probability}</td>
                        <td style="text-align:center">${d.severity}</td>
                        <td style="text-align:center; font-weight:700">${d.nr}</td>
                        <td style="text-align:center; color:${d.color}; font-weight:700">${d.nrLabel}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório PGR — ${params.campaignName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; background: white; }

  .header { background: #1e3a5f; color: white; padding: 24px 32px; margin-bottom: 20px; }
  .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
  .header p { font-size: 11px; opacity: 0.85; margin-top: 2px; }

  .section { padding: 0 32px; margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: 700; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-bottom: 12px; }

  .matrix-table, .dim-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
  .matrix-table th, .dim-table th { background: #e879a0; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
  .matrix-table td, .dim-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  .matrix-table tr:nth-child(even), .dim-table tr:nth-child(even) { background: #f8fafc; }

  .anonymity-note { background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 10px; color: #713f12; }

  .unit { margin-bottom: 16px; }
  .unit-header { background: #1e3a5f; color: white; padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 4px; margin-bottom: 8px; }
  .sector { margin-left: 16px; margin-bottom: 10px; }
  .sector-header { background: #dbeafe; color: #1e40af; padding: 5px 12px; font-size: 11px; font-weight: 600; border-radius: 3px; margin-bottom: 6px; }
  .position { margin-left: 24px; margin-bottom: 10px; }
  .position-header { font-size: 10px; font-weight: 600; color: #475569; padding: 3px 0; margin-bottom: 4px; }
  .suppressed { font-size: 10px; color: #94a3b8; font-style: italic; padding: 4px 0; }

  .footer { position: fixed; bottom: 20px; left: 32px; right: 32px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { page-break-inside: avoid; }
    .unit { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <h1>Relatório PGR — Riscos Psicossociais NR-1</h1>
  <p><strong>${params.companyName}</strong> — CNPJ: ${params.cnpj}</p>
  <p>Campanha: ${params.campaignName} &nbsp;|&nbsp; Período: ${params.startDate} a ${params.endDate}</p>
  <p>Gerado em: ${params.generatedAt} &nbsp;|&nbsp; Instrumento: HSE-IT (35 questões, 7 dimensões)</p>
  <p>Respondentes: ${params.totalResponded} de ${params.totalInvited} convidados</p>
</div>

<!-- ANONYMITY NOTE -->
<div class="section">
  <div class="anonymity-note">
    <strong>Nota de anonimato (LGPD Art. 12):</strong> Os scores são calculados sobre o total de ${params.totalResponded} respondentes da campanha.
    Por garantia técnica de anonimato (arquitetura Blind-Drop), não é possível vincular respostas individuais a cargos específicos.
    Cargos com menos de ${MIN_RESPONDENTS} respondentes têm dados suprimidos.
  </div>
</div>

<!-- SCORING MATRIX -->
<div class="section">
  <div class="section-title">Matriz de Cálculo — Análise por Unidade/Setor/Cargo × Categorias</div>
  <table class="matrix-table">
    <thead>
      <tr>
        <th>Score HSE-IT</th>
        <th>Classificação</th>
        <th>Probabilidade (P)</th>
        <th>Severidade (S)*</th>
        <th>NR = P × S</th>
        <th>Nível Final</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>3,1–4,0 (negativos) / 0–1 (positivos)</td>
        <td style="font-weight:700">ALTO RISCO</td>
        <td style="text-align:center">4</td>
        <td style="text-align:center">4</td>
        <td style="text-align:center; font-weight:700">4–16</td>
        <td style="color:#f97316; font-weight:700">Importante / Crítico</td>
      </tr>
      <tr style="background:#f8fafc">
        <td>2,1–3,0 (negativos) / 1,1–2 (positivos)</td>
        <td>Risco Moderado</td>
        <td style="text-align:center">3</td>
        <td style="text-align:center">3</td>
        <td style="text-align:center; font-weight:700">3–12</td>
        <td style="color:#eab308; font-weight:700">Moderado / Importante</td>
      </tr>
      <tr>
        <td>1,1–2,0 (negativos) / 2,1–3 (positivos)</td>
        <td>Risco Médio</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center; font-weight:700">2–8</td>
        <td style="color:#22c55e; font-weight:700">Aceitável / Moderado</td>
      </tr>
      <tr style="background:#f8fafc">
        <td>0–1,0 (negativos) / 3,1–4 (positivos)</td>
        <td>Baixo Risco</td>
        <td style="text-align:center">1</td>
        <td style="text-align:center">1</td>
        <td style="text-align:center; font-weight:700">1–4</td>
        <td style="color:#22c55e; font-weight:700">Baixo / Aceitável</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:9px;color:#64748b">*S = Severidade: 1 Leve | 2 Moderado | 3 Significativo | 4 Grave (adoecimento severo)</p>
</div>

<!-- CAMPAIGN SUMMARY BY DIMENSION -->
<div class="section">
  <div class="section-title">Resumo da Campanha — Score por Dimensão</div>
  <table class="matrix-table">
    <thead>
      <tr>
        <th>Dimensão</th>
        <th style="text-align:center">Score Médio</th>
        <th style="text-align:center">Classificação</th>
        <th style="text-align:center">P</th>
        <th style="text-align:center">S</th>
        <th style="text-align:center">NR = P×S</th>
        <th style="text-align:center">Nível Final</th>
      </tr>
    </thead>
    <tbody>${dimRows}</tbody>
  </table>
</div>

<!-- HIERARCHY -->
<div class="section">
  <div class="section-title">Análise por Unidade / Setor / Cargo</div>
  ${hierarchyHtml}
</div>

<!-- FOOTER -->
<div class="footer">
  <span>Asta — Plataforma de Riscos Psicossociais NR-1 | Confidencial</span>
  <span>${params.companyName} — ${params.campaignName} — ${params.generatedAt}</span>
</div>

</body>
</html>`;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { company: { select: { name: true, cnpj: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    if (campaign.status !== 'closed') {
      return NextResponse.json({ error: 'Relatório disponível apenas para campanhas encerradas' }, { status: 400 });
    }
    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allResponses = await prisma.surveyResponse.findMany({
      where: { campaign_id: id },
      select: { responses: true },
    });

    const totalInvited = await prisma.surveyInvitation.count({ where: { campaign_id: id } });
    const totalResponded = allResponses.length;

    if (totalResponded === 0) {
      return NextResponse.json({ error: 'Nenhuma resposta encontrada para esta campanha' }, { status: 404 });
    }

    const campaignDimensions = HSE_DIMENSIONS.map(dim => {
      let total = 0;
      let count = 0;
      for (const resp of allResponses) {
        const answers = resp.responses as Record<string, number>;
        for (const qn of dim.questionNumbers) {
          const val = answers[`q${qn}`];
          if (val !== undefined) { total += val; count++; }
        }
      }
      const score = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
      const riskLevel = ScoreService.getRiskLevel(score, dim.type) as RiskLevel;
      const probabilityMap: Record<RiskLevel, number> = { critico: 4, importante: 3, moderado: 2, aceitavel: 1 };
      const probability = probabilityMap[riskLevel];
      const severity = probability;
      const nr = probability * severity;
      const { label: nrLabel, color } = ScoreService.interpretNR(nr);
      return { key: dim.key, name: dim.name, score, riskLevel, probability, severity, nr, nrLabel, color };
    });

    const dimensionMap = Object.fromEntries(
      campaignDimensions.map(d => [d.key, {
        score: d.score, riskLevel: d.riskLevel, probability: d.probability,
        severity: d.severity, nr: d.nr, nrLabel: d.nrLabel, color: d.color,
      }])
    );

    const units = await prisma.campaignUnit.findMany({
      where: { campaign_id: id },
      include: {
        sectors: {
          include: { positions: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const unitReports = units.map(unit => ({
      name: unit.name,
      sectors: unit.sectors.map(sector => ({
        name: sector.name,
        positions: sector.positions.map(position => ({
          name: position.name,
          dimensions: totalResponded >= 5 ? dimensionMap : {},
        })),
      })),
    }));

    const now = new Date();
    const html = buildPGRHtml({
      companyName: campaign.company.name,
      cnpj: campaign.company.cnpj,
      campaignName: campaign.name,
      startDate: new Date(campaign.start_date).toLocaleDateString('pt-BR'),
      endDate: new Date(campaign.end_date).toLocaleDateString('pt-BR'),
      generatedAt: now.toLocaleString('pt-BR'),
      totalResponded,
      totalInvited,
      units: unitReports,
      campaignDimensions,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="PGR_${campaign.name.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.html"`,
      },
    });

  } catch (err) {
    console.error('PGR PDF error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
