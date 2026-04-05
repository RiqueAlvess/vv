import { prisma } from '@/lib/prisma';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from '@/services/score.service';
import * as XLSX from 'xlsx';
import type { DimensionType, RiskLevel } from '@/types';

export async function buildDashboardXlsxArtifact(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { company: { select: { name: true, cnpj: true } } },
  });
  if (!campaign) throw new Error('Campanha não encontrada');
  if (campaign.status !== 'closed') throw new Error('Exportação disponível apenas para campanhas encerradas');

  const rawResponses = await prisma.surveyResponse.findMany({
    where: { campaign_id: campaignId },
    select: { id: true, gender: true, age_range: true, responses: true, unit_id: true, sector_id: true, position_id: true, created_at: true },
  });
  if (rawResponses.length === 0) throw new Error('Nenhuma resposta encontrada');

  const responses = rawResponses.map(r => ({ ...r, responses: r.responses as Record<string, number> }));
  const totalResponded = responses.length;

  const dimensionAnalysis = HSE_DIMENSIONS.map(dim => {
    let total = 0, count = 0;
    for (const resp of responses) {
      for (const qn of dim.questionNumbers) {
        const val = ScoreService.getQuestionAnswer(resp.responses, qn);
        if (typeof val === 'number') { total += val; count++; }
      }
    }
    const avgScore = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
    const riskLevel = ScoreService.getRiskLevel(avgScore, dim.type);
    const nr = ScoreService.calculateNR(riskLevel);
    const { label } = ScoreService.interpretNR(nr);
    return { dimensao: dim.name, tipo: dim.type, score_medio: avgScore, nivel_risco: riskLevel, nr, nivel_final: label };
  });

  const igrp = Math.round(dimensionAnalysis.reduce((s, d) => s + d.nr, 0) / dimensionAnalysis.length * 100) / 100;

  const sheetResumo = [
    ['Empresa', campaign.company.name],
    ['CNPJ', campaign.company.cnpj],
    ['Campanha', campaign.name],
    ['Status', 'Encerrada'],
    ['Total Respondentes', totalResponded],
    ['IGRP', igrp],
    [],
    ['Dimensão', 'Score Médio', 'Nível de Risco', 'NR', 'Nível Final'],
    ...dimensionAnalysis.map(d => [d.dimensao, d.score_medio, d.nivel_risco, d.nr, d.nivel_final]),
  ];

  const GENDER_LABELS: Record<string, string> = { M: 'Masculino', F: 'Feminino', O: 'Outro', N: 'Não informado' };
  const genderMap: Record<string, { count: number }> = {};
  for (const r of responses) {
    const g = GENDER_LABELS[r.gender ?? 'N'] ?? 'Não informado';
    if (!genderMap[g]) genderMap[g] = { count: 0 };
    genderMap[g].count++;
  }
  const sheetGenero = [
    ['Gênero', 'Respondentes', '% do Total'],
    ...Object.entries(genderMap).map(([g, d]) => [g, d.count, +(d.count / totalResponded * 100).toFixed(1)]),
  ];

  const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
  const ageMap: Record<string, number> = {};
  for (const r of responses) {
    const a = r.age_range ?? 'Não informado';
    ageMap[a] = (ageMap[a] ?? 0) + 1;
  }
  const ageRows = Object.entries(ageMap).sort(([a], [b]) => {
    const ai = AGE_ORDER.indexOf(a), bi = AGE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const sheetIdade = [
    ['Faixa Etária', 'Respondentes', '% do Total'],
    ...ageRows.map(([a, c]) => [a, c, +(c / totalResponded * 100).toFixed(1)]),
  ];

  const sheetDistribuicao = [
    ['Dimensão', 'Aceitável (%)', 'Moderado (%)', 'Importante (%)', 'Crítico (%)'],
    ...HSE_DIMENSIONS.map(dim => {
      const counts = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
      for (const resp of responses) {
        const score = ScoreService.calculateDimensionScore(resp.responses, dim.key as DimensionType);
        const risk = ScoreService.getRiskLevel(score, dim.type);
        counts[risk]++;
      }
      return [
        dim.name,
        +(counts.aceitavel / totalResponded * 100).toFixed(1),
        +(counts.moderado / totalResponded * 100).toFixed(1),
        +(counts.importante / totalResponded * 100).toFixed(1),
        +(counts.critico / totalResponded * 100).toFixed(1),
      ];
    }),
  ];

  const positions = await prisma.campaignPosition.findMany({
    where: { sector: { unit: { campaign_id: campaignId } } },
    select: { id: true, name: true, sector: { select: { name: true, unit: { select: { name: true } } } } },
  });
  const sheetCargos = [
    ['Unidade', 'Setor', 'Cargo', 'IGRP (campanha)', 'Nível Final'],
    ...positions.map(p => [p.sector.unit.name, p.sector.name, p.name, igrp, ScoreService.interpretNR(igrp).label]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetResumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetDistribuicao), 'Distribuicao Risco');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetGenero), 'Genero');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetIdade), 'Faixa Etaria');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetCargos), 'Hierarquia');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `Dashboard_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

  return {
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: Buffer.from(buffer).toString('base64'),
  };
}

function riskLabel(riskLevel: string): string {
  if (riskLevel === 'critico') return 'ALTO RISCO';
  if (riskLevel === 'importante') return 'Risco Moderado';
  if (riskLevel === 'moderado') return 'Risco Médio';
  return 'Baixo Risco';
}

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
  const dimRows = params.campaignDimensions.map(d => `
    <tr>
      <td>${d.name}</td>
      <td style="text-align:center">${d.score.toFixed(2)}</td>
      <td style="text-align:center">${riskLabel(d.riskLevel)}</td>
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
            if (!hasDims) {
              return `
                <div class="position">
                  <div class="position-header">Cargo: ${position.name}</div>
                  <div class="suppressed">Sem dados de resposta para este cargo</div>
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
                        <td style="text-align:center">${riskLabel(d.riskLevel)}</td>
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
  .matrix-table th, .dim-table th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
  .matrix-table td, .dim-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  .matrix-table tr:nth-child(even), .dim-table tr:nth-child(even) { background: #f8fafc; }

  .unit { margin-bottom: 16px; }
  .unit-header { background: #1e3a5f; color: white; padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 4px; margin-bottom: 8px; }
  .sector { margin-left: 16px; margin-bottom: 10px; }
  .sector-header { background: #dbeafe; color: #1e40af; padding: 5px 12px; font-size: 11px; font-weight: 600; border-radius: 3px; margin-bottom: 6px; }
  .position { margin-left: 24px; margin-bottom: 10px; }
  .position-header { font-size: 10px; font-weight: 600; color: #475569; padding: 3px 0; margin-bottom: 4px; }
  .suppressed { font-size: 10px; color: #94a3b8; font-style: italic; padding: 4px 0; }

  .footer { margin-top: 32px; padding: 12px 32px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }

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
  <p>Respondentes: ${params.totalResponded}</p>
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
        <td style="text-align:center; font-weight:700">16</td>
        <td style="color:#cc0000; font-weight:700">Crítico</td>
      </tr>
      <tr style="background:#f8fafc">
        <td>2,1–3,0 (negativos) / 1,1–2 (positivos)</td>
        <td>Risco Moderado</td>
        <td style="text-align:center">3</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center; font-weight:700">6</td>
        <td style="color:#cc7722; font-weight:700">Importante</td>
      </tr>
      <tr>
        <td>1,1–2,0 (negativos) / 2,1–3 (positivos)</td>
        <td>Risco Médio</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center; font-weight:700">4</td>
        <td style="color:#d4b000; font-weight:700">Moderado</td>
      </tr>
      <tr style="background:#f8fafc">
        <td>0–1,0 (negativos) / 3,1–4 (positivos)</td>
        <td>Baixo Risco</td>
        <td style="text-align:center">1</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center; font-weight:700">2</td>
        <td style="color:#8ba800; font-weight:700">Baixo</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:9px;color:#64748b">*S = Severidade fixa em 2 (impacto moderado na saúde psicossocial)</p>
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
  <span>Vivamente360 — Plataforma de Riscos Psicossociais NR-1 | Confidencial</span>
  <span>${params.companyName} — ${params.campaignName} — ${params.generatedAt}</span>
</div>

</body>
</html>`;
}

export async function buildCampaignPgrHtmlArtifact(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { company: { select: { name: true, cnpj: true } } },
  });
  if (!campaign) throw new Error('Campanha não encontrada');
  if (campaign.status !== 'closed') throw new Error('Relatório disponível apenas para campanhas encerradas');

  const allResponses = await prisma.surveyResponse.findMany({
    where: { campaign_id: campaignId },
    select: { responses: true, position_id: true },
  });
  if (allResponses.length === 0) throw new Error('Nenhuma resposta encontrada para esta campanha');

  const probabilityMap: Record<RiskLevel, number> = { critico: 4, importante: 3, moderado: 2, aceitavel: 1 };
  const responsesWithAnswers = allResponses.map((resp) => ({
    position_id: resp.position_id,
    answers: (resp.responses ?? {}) as Record<string, number>,
  }));

  const calculateDimensionsForAnswers = (answersList: Array<Record<string, number>>) => HSE_DIMENSIONS.map((dim) => {
    let scoreSum = 0;
    let scoreCount = 0;
    const riskCount = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 } satisfies Record<RiskLevel, number>;

    for (const answers of answersList) {
      const score = ScoreService.calculateDimensionScore(answers, dim.key);
      const riskLevel = ScoreService.getRiskLevel(score, dim.type) as RiskLevel;
      scoreSum += score;
      scoreCount++;
      riskCount[riskLevel] += 1;
    }

    const score = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
    const riskLevel = (Object.entries(riskCount) as Array<[RiskLevel, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'aceitavel';
    const probability = probabilityMap[riskLevel];
    const severity = probability;
    const nr = probability * severity;
    const { label: nrLabel, color } = ScoreService.interpretNR(nr);
    return { key: dim.key, name: dim.name, score, riskLevel, probability, severity, nr, nrLabel, color };
  });

  const campaignDimensions = calculateDimensionsForAnswers(responsesWithAnswers.map((resp) => resp.answers));

  const units = await prisma.campaignUnit.findMany({
    where: { campaign_id: campaignId },
    include: { sectors: { include: { positions: true }, orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  const unitReports = units.map(unit => ({
    name: unit.name,
    sectors: unit.sectors.map(sector => ({
      name: sector.name,
      positions: sector.positions.map(position => {
        const positionAnswers = responsesWithAnswers.filter((resp) => resp.position_id === position.id).map((resp) => resp.answers);
        if (positionAnswers.length === 0) {
          return { name: position.name, dimensions: {} };
        }

        const positionDimensions = calculateDimensionsForAnswers(positionAnswers);
        return {
          name: position.name,
          dimensions: Object.fromEntries(positionDimensions.map((d) => [d.key, {
            score: d.score,
            riskLevel: d.riskLevel,
            probability: d.probability,
            severity: d.severity,
            nr: d.nr,
            nrLabel: d.nrLabel,
            color: d.color,
          }])),
        };
      }),
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
    totalResponded: allResponses.length,
    totalInvited: 0,
    units: unitReports,
    campaignDimensions,
  });

  return {
    filename: `PGR_${campaign.name.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.html`,
    contentType: 'text/html; charset=utf-8',
    base64: Buffer.from(html, 'utf-8').toString('base64'),
  };
}
