import { prisma } from '@/lib/prisma';
import { HSE_DIMENSIONS, GENDER_LABELS, SECTOR_PRIVACY_MIN, SECTOR_AGGREGATED_MESSAGE } from '@/lib/constants';
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
    const nr = ScoreService.calculateNR(riskLevel, dim.key);
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
    ['Dimensão', 'Risco Baixo (%)', 'Risco Médio (%)', 'Risco Moderado (%)', 'Risco Alto (%)'],
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

  const employees = await prisma.campaignEmployee.findMany({
    where: { campaign_id: campaignId },
    select: { cpf_hash: true, has_responded: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });
  const sheetFuncionarios = [
    ['CPF (hash)', 'Respondeu', 'Cadastrado em'],
    ...employees.map(e => [
      e.cpf_hash ?? '-',
      e.has_responded ? 'Sim' : 'Não',
      new Date(e.created_at).toLocaleString('pt-BR'),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetResumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetDistribuicao), 'Distribuicao Risco');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetGenero), 'Genero');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetIdade), 'Faixa Etaria');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetCargos), 'Hierarquia');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetFuncionarios), 'Funcionarios');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `Dashboard_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

  return {
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: Buffer.from(buffer).toString('base64'),
  };
}

function riskLabel(riskLevel: string): string {
  if (riskLevel === 'critico') return 'Risco Alto';
  if (riskLevel === 'importante') return 'Risco Moderado';
  if (riskLevel === 'moderado') return 'Risco Médio';
  return 'Risco Baixo';
}

type DimReport = { score: number; riskLevel: string; probability: number; severity: number; nr: number; nrLabel: string; color: string };
// `aggregated: true` means these dimensions are the company-wide aggregate, shown in place
// of the sector's own (too small to disclose) data — `message` explains that substitution.
type SectorReport = { name: string; aggregated: boolean; message?: string; dimensions: Record<string, DimReport> };
type UnitReport = { name: string; sectors: SectorReport[] };

function buildPGRHtml(params: {
  companyName: string;
  cnpj: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalResponded: number;
  totalInvited: number;
  units: UnitReport[];
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
          <div class="sector-header">GHE / Setor: ${sector.name}</div>
          ${sector.aggregated ? `<p class="suppressed">🛡️ ${sector.message}</p>` : ''}
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
              ${Object.entries(sector.dimensions).map(([key, d]) => `
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

  .header { background: #144660; color: white; padding: 20px 32px; margin-bottom: 20px; display: flex; align-items: center; gap: 24px; }
  .header-logo { height: 48px; width: auto; filter: brightness(0) invert(1); flex-shrink: 0; }
  .header-text h1 { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
  .header-text p { font-size: 10px; opacity: 0.85; margin-top: 2px; }

  .section { padding: 0 32px; margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: 700; color: #144660; border-bottom: 2px solid #144660; padding-bottom: 4px; margin-bottom: 12px; }

  .matrix-table, .dim-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
  .matrix-table th, .dim-table th { background: #144660; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
  .matrix-table td, .dim-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  .matrix-table tr:nth-child(even), .dim-table tr:nth-child(even) { background: #f8fafc; }

  .unit { margin-bottom: 16px; }
  .unit-header { background: #144660; color: white; padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 4px; margin-bottom: 8px; }
  .sector { margin-left: 16px; margin-bottom: 10px; }
  .sector-header { background: #e0eef7; color: #144660; padding: 5px 12px; font-size: 11px; font-weight: 600; border-radius: 3px; margin-bottom: 6px; }
  .position { margin-left: 24px; margin-bottom: 10px; }
  .position-header { font-size: 10px; font-weight: 600; color: #475569; padding: 3px 0; margin-bottom: 4px; }
  .suppressed { font-size: 10px; color: #94a3b8; font-style: italic; padding: 4px 0; }

  .footer { margin-top: 32px; padding: 12px 32px; border-top: 2px solid #144660; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; }
  .footer-logo { height: 20px; width: auto; opacity: 0.6; }

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
  <img class="header-logo" src="/logo.png" alt="Vivamente360" />
  <div class="header-text">
    <h1>Relatório PGR — Riscos Psicossociais NR-1</h1>
    <p><strong>${params.companyName}</strong> — CNPJ: ${params.cnpj}</p>
    <p>Campanha: ${params.campaignName} &nbsp;|&nbsp; Período: ${params.startDate} a ${params.endDate}</p>
    <p>Gerado em: ${params.generatedAt} &nbsp;|&nbsp; Instrumento: HSE-IT (35 questões, 7 dimensões) &nbsp;|&nbsp; Respondentes: ${params.totalResponded}</p>
  </div>
</div>

<!-- SCORING MATRIX -->
<div class="section">
  <div class="section-title">Matriz de Risco — Metodologia NR-1</div>
  <table class="matrix-table">
    <thead>
      <tr>
        <th>Score HSE-IT</th>
        <th>Classificação</th>
        <th>Probabilidade (P)</th>
        <th>Severidade (S)</th>
        <th>NR = P × S</th>
        <th>Nível Final</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>3,1–4,0 (negativos) / 0–1,0 (positivos)</td>
        <td style="font-weight:700; color:#F60000">Risco Alto</td>
        <td style="text-align:center">4</td>
        <td style="text-align:center">4</td>
        <td style="text-align:center; font-weight:700">16</td>
        <td style="color:#F60000; font-weight:700">Risco Alto</td>
      </tr>
      <tr style="background:#f8fafc">
        <td>2,1–3,0 (negativos) / 1,1–2,0 (positivos)</td>
        <td style="font-weight:700; color:#F75900">Risco Moderado</td>
        <td style="text-align:center">3</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center; font-weight:700">6</td>
        <td style="color:#F75900; font-weight:700">Risco Moderado</td>
      </tr>
      <tr>
        <td>1,1–2,0 (negativos) / 2,1–3,0 (positivos)</td>
        <td style="font-weight:700; color:#F7B511">Risco Médio</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center; font-weight:700">4</td>
        <td style="color:#F7B511; font-weight:700">Risco Médio</td>
      </tr>
      <tr style="background:#f8fafc">
        <td>0–1,0 (negativos) / 3,1–4,0 (positivos)</td>
        <td style="font-weight:700; color:#009B00">Risco Baixo</td>
        <td style="text-align:center">1</td>
        <td style="text-align:center">2</td>
        <td style="text-align:center; font-weight:700">2</td>
        <td style="color:#009B00; font-weight:700">Risco Baixo</td>
      </tr>
    </tbody>
  </table>
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
  <div class="section-title">Análise por GHE (Grupo Homogêneo de Exposição) / Setor</div>
  ${hierarchyHtml}
</div>

<!-- FOOTER -->
<div class="footer">
  <img class="footer-logo" src="/logo.png" alt="Vivamente360" />
  <span>${params.companyName} — ${params.campaignName} — Confidencial</span>
  <span>${params.generatedAt}</span>
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
    select: { responses: true, sector_id: true, position_id: true },
  });
  if (allResponses.length === 0) throw new Error('Nenhuma resposta encontrada para esta campanha');

  const probabilityMap: Record<RiskLevel, number> = { critico: 4, importante: 3, moderado: 2, aceitavel: 1 };

  // Resolve sector_id from position when sector_id is null
  const nullPosIds = [...new Set(
    allResponses.filter(r => r.sector_id === null && r.position_id !== null).map(r => r.position_id!)
  )];
  const posToSector: Record<string, string> = {};
  if (nullPosIds.length > 0) {
    const posRows = await prisma.campaignPosition.findMany({
      where: { id: { in: nullPosIds } },
      select: { id: true, sector_id: true },
    });
    for (const p of posRows) posToSector[p.id] = p.sector_id;
  }

  const responsesWithAnswers = allResponses.map((resp) => ({
    sector_id: resp.sector_id ?? (resp.position_id ? posToSector[resp.position_id] ?? null : null),
    answers: (resp.responses ?? {}) as Record<string, number>,
  }));

  const calcDimsForAnswers = (answersList: Array<Record<string, number>>) => HSE_DIMENSIONS.map((dim) => {
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
    const severity = riskLevel === 'critico' ? 4 : 2;
    const nr = probability * severity;
    const { label: nrLabel, color } = ScoreService.interpretNR(nr);
    return { key: dim.key, name: dim.name, score, riskLevel, probability, severity, nr, nrLabel, color };
  });

  const campaignDimensions = calcDimsForAnswers(responsesWithAnswers.map((r) => r.answers));

  const units = await prisma.campaignUnit.findMany({
    where: { campaign_id: campaignId },
    include: { sectors: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  const companyDimensionsRecord = Object.fromEntries(campaignDimensions.map(d => [d.key, {
    score: d.score, riskLevel: d.riskLevel, probability: d.probability,
    severity: d.severity, nr: d.nr, nrLabel: d.nrLabel, color: d.color,
  }]));

  const unitReports: UnitReport[] = units
    .map(unit => ({
      name: unit.name,
      sectors: unit.sectors.map((sector): SectorReport => {
        const sectorAnswers = responsesWithAnswers.filter(r => r.sector_id === sector.id).map(r => r.answers);
        if (sectorAnswers.length < SECTOR_PRIVACY_MIN) {
          return {
            name: sector.name,
            aggregated: true,
            message: SECTOR_AGGREGATED_MESSAGE,
            dimensions: companyDimensionsRecord,
          };
        }
        const sectorDims = calcDimsForAnswers(sectorAnswers);
        return {
          name: sector.name,
          aggregated: false,
          dimensions: Object.fromEntries(sectorDims.map(d => [d.key, {
            score: d.score, riskLevel: d.riskLevel, probability: d.probability,
            severity: d.severity, nr: d.nr, nrLabel: d.nrLabel, color: d.color,
          }])),
        };
      }),
    }))
    .filter(u => u.sectors.length > 0);

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

export async function buildPgrXlsxArtifact(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { company: { select: { name: true, cnpj: true } } },
  });
  if (!campaign) throw new Error('Campanha não encontrada');
  if (campaign.status !== 'closed') throw new Error('Relatório disponível apenas para campanhas encerradas');

  const allResponses = await prisma.surveyResponse.findMany({
    where: { campaign_id: campaignId },
    select: { responses: true, sector_id: true, position_id: true, gender: true, age_range: true },
  });
  if (allResponses.length === 0) throw new Error('Nenhuma resposta encontrada para esta campanha');

  const probabilityMap: Record<RiskLevel, number> = { critico: 4, importante: 3, moderado: 2, aceitavel: 1 };
  const totalResponded = allResponses.length;

  // Resolve sector_id from position when sector_id is null
  const xlsxNullPosIds = [...new Set(
    allResponses.filter(r => r.sector_id === null && r.position_id !== null).map(r => r.position_id!)
  )];
  const xlsxPosToSector: Record<string, string> = {};
  if (xlsxNullPosIds.length > 0) {
    const posRows = await prisma.campaignPosition.findMany({
      where: { id: { in: xlsxNullPosIds } },
      select: { id: true, sector_id: true },
    });
    for (const p of posRows) xlsxPosToSector[p.id] = p.sector_id;
  }

  const responsesData = allResponses.map(r => ({
    sector_id: r.sector_id ?? (r.position_id ? xlsxPosToSector[r.position_id] ?? null : null),
    gender: r.gender,
    age_range: r.age_range,
    answers: (r.responses ?? {}) as Record<string, number>,
  }));

  const calcDims = (answersList: Array<Record<string, number>>) =>
    HSE_DIMENSIONS.map(dim => {
      let scoreSum = 0, scoreCount = 0;
      const riskCount = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 } satisfies Record<RiskLevel, number>;
      for (const answers of answersList) {
        const score = ScoreService.calculateDimensionScore(answers, dim.key);
        const riskLevel = ScoreService.getRiskLevel(score, dim.type) as RiskLevel;
        scoreSum += score;
        scoreCount++;
        riskCount[riskLevel]++;
      }
      const score = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
      const riskLevel = (Object.entries(riskCount) as Array<[RiskLevel, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'aceitavel';
      const probability = probabilityMap[riskLevel];
      const severity = riskLevel === 'critico' ? 4 : 2;
      const nr = probability * severity;
      const { label: nrLabel } = ScoreService.interpretNR(nr);
      return { key: dim.key, name: dim.name, score, riskLevel, probability, severity, nr, nrLabel };
    });

  const campaignDims = calcDims(responsesData.map(r => r.answers));
  const igrp = Math.round(campaignDims.reduce((s, d) => s + d.nr, 0) / campaignDims.length * 100) / 100;
  const now = new Date();

  // Sheet 1: Identificação
  const sheetId = [
    ['RELATÓRIO PGR — RISCOS PSICOSSOCIAIS NR-1'],
    [],
    ['Empresa', campaign.company.name],
    ['CNPJ', campaign.company.cnpj],
    ['Campanha', campaign.name],
    ['Status', 'Encerrada'],
    ['Período', `${new Date(campaign.start_date).toLocaleDateString('pt-BR')} a ${new Date(campaign.end_date).toLocaleDateString('pt-BR')}`],
    ['Total de Respondentes', totalResponded],
    ['IGRP (Índice Geral de Risco Psicossocial)', igrp],
    ['Instrumento', 'HSE-IT (35 questões, 7 dimensões)'],
    ['Gerado em', now.toLocaleString('pt-BR')],
  ];

  // Sheet 2: Síntese dos Riscos
  const sheetRiscos = [
    ['Dimensão', 'Tipo', 'Score Médio', 'Classificação', 'Probabilidade (P)', 'Severidade (S)', 'NR = P×S', 'Nível Final'],
    ...campaignDims.map(d => [
      d.name,
      d.key === 'demandas' || d.key === 'relacionamentos' ? 'Negativa' : 'Positiva',
      d.score,
      d.riskLevel,
      d.probability,
      d.severity,
      d.nr,
      d.nrLabel,
    ]),
    [],
    ['IGRP', '', '', '', '', '', igrp, ScoreService.interpretNR(igrp).label],
  ];

  // Sheet 3 + 4: Análise por GHE/Setor — sem cargo
  const xlsxUnits = await prisma.campaignUnit.findMany({
    where: { campaign_id: campaignId },
    include: { sectors: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  const dimNames = HSE_DIMENSIONS.map(d => d.name);
  const DIM_HEADER = ['Dimensão', 'Score', 'Classificação', 'P', 'S', 'NR = P×S', 'Nível Final'];

  // Sheet 3: Matriz detalhada por GHE/Setor — XLSX exposes full per-sector data, unfiltered
  const sheetMatriz: unknown[][] = [];
  for (const unit of xlsxUnits) {
    for (const sector of unit.sectors) {
      const secAnswers = responsesData.filter(r => r.sector_id === sector.id).map(r => r.answers);
      sheetMatriz.push([`UNIDADE: ${unit.name}`]);
      sheetMatriz.push([`GHE / Setor: ${sector.name}`]);
      sheetMatriz.push(DIM_HEADER);
      const secDims = calcDims(secAnswers);
      for (const d of secDims) {
        sheetMatriz.push([d.name, d.score, d.nrLabel, d.probability, d.severity, d.nr, d.nrLabel]);
      }
      const secIgrp = Math.round(secDims.reduce((s, d) => s + d.nr, 0) / secDims.length * 100) / 100;
      sheetMatriz.push(['IGRP', '', '', '', '', secIgrp, ScoreService.interpretNR(secIgrp).label]);
      sheetMatriz.push([]);
    }
  }

  // Sheet 4: Tabela resumo por GHE/Setor
  const sheetSetor: unknown[][] = [
    ['Unidade', 'GHE / Setor', 'N Respondentes', ...dimNames, 'IGRP Estimado'],
  ];
  for (const unit of xlsxUnits) {
    for (const sector of unit.sectors) {
      const secAnswers = responsesData.filter(r => r.sector_id === sector.id).map(r => r.answers);
      const secDims = calcDims(secAnswers);
      const secIgrp = Math.round(secDims.reduce((s, d) => s + d.nr, 0) / secDims.length * 100) / 100;
      sheetSetor.push([unit.name, sector.name, secAnswers.length, ...secDims.map(d => d.nr), secIgrp]);
    }
  }

  // Sheet 5: Análise Demográfica — gender
  const genderDimHeader = ['Gênero', 'N', ...dimNames, 'IGRP Estimado'];
  const genderGroups: Record<string, Array<Record<string, number>>> = {};
  for (const r of responsesData) {
    const g = GENDER_LABELS[r.gender ?? 'N'] ?? 'Não informado';
    if (!genderGroups[g]) genderGroups[g] = [];
    genderGroups[g].push(r.answers);
  }
  const sheetDemo: unknown[][] = [
    ['ANÁLISE DEMOGRÁFICA — GÊNERO'],
    genderDimHeader,
    ...Object.entries(genderGroups).map(([g, answers]) => {
      const dims = calcDims(answers);
      const ig = Math.round(dims.reduce((s, d) => s + d.nr, 0) / dims.length * 100) / 100;
      return [g, answers.length, ...dims.map(d => d.nr), ig];
    }),
    [],
    ['ANÁLISE DEMOGRÁFICA — FAIXA ETÁRIA'],
    ['Faixa Etária', 'N', ...dimNames, 'IGRP Estimado'],
  ];
  const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
  const ageGroups: Record<string, Array<Record<string, number>>> = {};
  for (const r of responsesData) {
    const a = r.age_range ?? 'Não informado';
    if (!ageGroups[a]) ageGroups[a] = [];
    ageGroups[a].push(r.answers);
  }
  const ageEntries = Object.entries(ageGroups).sort(([a], [b]) => {
    const ai = AGE_ORDER.indexOf(a), bi = AGE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const [age, answers] of ageEntries) {
    const dims = calcDims(answers);
    const ig = Math.round(dims.reduce((s, d) => s + d.nr, 0) / dims.length * 100) / 100;
    sheetDemo.push([age, answers.length, ...dims.map(d => d.nr), ig]);
  }

  // Sheet 6: Plano de Ação (if exists)
  const actionPlan = await prisma.actionPlan.findUnique({ where: { campaign_id: campaignId } });

  type ActionItem = { description: string; responsible?: string; deadline?: string; status: string };
  type Problem = { title: string; dimension?: string; severity: string; actions?: ActionItem[] };

  let sheetPlano: unknown[][] = [['Nenhum plano de ação gerado para esta campanha.']];
  const problems = Array.isArray(actionPlan?.problems) ? (actionPlan.problems as unknown as Problem[]) : [];
  if (problems.length > 0) {
    sheetPlano = [
      ['Problema', 'Dimensão', 'Severidade', 'Ação', 'Responsável', 'Prazo', 'Status'],
    ];
    for (const prob of problems) {
      const actions = prob.actions ?? [];
      if (actions.length === 0) {
        sheetPlano.push([prob.title, prob.dimension ?? '', prob.severity, '', '', '', '']);
      } else {
        for (const [i, action] of actions.entries()) {
          sheetPlano.push([
            i === 0 ? prob.title : '',
            i === 0 ? (prob.dimension ?? '') : '',
            i === 0 ? prob.severity : '',
            action.description,
            action.responsible ?? '',
            action.deadline ?? '',
            action.status,
          ]);
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetId), 'Identificação');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetRiscos), 'Síntese dos Riscos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetMatriz), 'Matriz por GHE');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetSetor), 'Análise por GHE');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetDemo), 'Análise Demográfica');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetPlano), 'Plano de Ação');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `PGR_${campaign.name.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.xlsx`;

  return {
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: Buffer.from(buffer).toString('base64'),
  };
}
