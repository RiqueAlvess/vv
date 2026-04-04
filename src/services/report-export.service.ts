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
        const val = resp.responses[`q${qn}`];
        if (val !== undefined) { total += val; count++; }
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
  const dimRows = params.campaignDimensions.map(d => `<tr><td>${d.name}</td><td style="text-align:center">${d.score.toFixed(2)}</td><td style="text-align:center">${d.riskLevel}</td><td style="text-align:center">${d.probability}</td><td style="text-align:center">${d.severity}</td><td style="text-align:center; font-weight:600">${d.nr}</td><td style="text-align:center; color:${d.color}; font-weight:600">${d.nrLabel}</td></tr>`).join('');
  const hierarchyHtml = params.units.map(unit => `<div><h3>${unit.name}</h3>${unit.sectors.map(sector => `<h4>${sector.name}</h4>${sector.positions.map(position => `<p>${position.name}</p>`).join('')}`).join('')}</div>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório PGR — ${params.campaignName}</title></head><body><h1>Relatório PGR</h1><p>${params.companyName} - ${params.cnpj}</p><p>Campanha: ${params.campaignName}</p><p>Respondentes: ${params.totalResponded}</p><table><tbody>${dimRows}</tbody></table>${hierarchyHtml}</body></html>`;
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
