import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { ScoreService } from '@/services/score.service';
import * as XLSX from 'xlsx';
import type { DimensionType } from '@/types';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM') return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      company: { select: { name: true, cnpj: true } },
    },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (campaign.status !== 'closed') {
    return NextResponse.json({ error: 'Exportação disponível apenas para campanhas encerradas' }, { status: 400 });
  }

  const rawResponses = await prisma.surveyResponse.findMany({
    where: { campaign_id: id },
    select: { id: true, gender: true, age_range: true, responses: true, unit_id: true, sector_id: true, position_id: true, created_at: true },
  });

  if (rawResponses.length === 0) {
    return NextResponse.json({ error: 'Nenhuma resposta encontrada' }, { status: 404 });
  }

  const responses = rawResponses.map(r => ({ ...r, responses: r.responses as Record<string, number> }));
  const totalResponded = responses.length;

  // ── Dimension analysis ────────────────────────────────────────────────
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

  // ── Sheet 1: Resumo ───────────────────────────────────────────────────
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

  // ── Sheet 2: Demográficos — Gênero ────────────────────────────────────
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

  // ── Sheet 3: Demográficos — Faixa Etária ─────────────────────────────
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

  // ── Sheet 4: Distribuição de Risco por Dimensão ───────────────────────
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

  // ── Sheet 5: Hierarchy / Position Table ──────────────────────────────
  const positions = await prisma.campaignPosition.findMany({
    where: { sector: { unit: { campaign_id: id } } },
    select: { id: true, name: true, sector: { select: { name: true, unit: { select: { name: true } } } } },
  });
  const sheetCargos = [
    ['Unidade', 'Setor', 'Cargo', 'IGRP (campanha)', 'Nível Final'],
    ...positions.map(p => [p.sector.unit.name, p.sector.name, p.name, igrp, ScoreService.interpretNR(igrp).label]),
  ];

  // ── Build workbook ────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetResumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetDistribuicao), 'Distribuicao Risco');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetGenero), 'Genero');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetIdade), 'Faixa Etaria');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetCargos), 'Hierarquia');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `Dashboard_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
