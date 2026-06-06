import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { getProportionalBands, COMPANY_SIZE_LABELS } from '@/lib/company-size';

export const dynamic = 'force-dynamic';

const SIZE_MIN_COMPANIES = 2;

const DIM_KEYS = [
  'demandas', 'controle', 'apoio_chefia', 'apoio_colegas',
  'relacionamentos', 'cargo', 'comunicacao_mudancas',
] as const;

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Derive company size from the largest campaign's employee count
  const campaigns = await prisma.campaign.findMany({
    where: { company_id: user.company_id, status: 'closed' },
    select: { id: true },
    orderBy: { end_date: 'desc' },
    take: 5,
  });

  let companySizeBand: string | null = null;
  let maxCount = 0;

  for (const c of campaigns) {
    const count = await prisma.campaignEmployee.count({ where: { campaign_id: c.id } });
    if (count > maxCount) { maxCount = count; }
  }

  if (maxCount > 0) {
    companySizeBand = String(maxCount); // kept as a local label only; bands used for query
  }

  if (!maxCount) {
    return NextResponse.json({
      available: false,
      reason: 'no_employee_data',
      hint: 'Faça upload de funcionários em pelo menos uma campanha encerrada para ativar o benchmarking.',
    });
  }

  // Proportional matching: include all size bands within ±30 % of current headcount
  const bands = getProportionalBands(maxCount);

  const snapshots = await prisma.benchmarkSnapshot.findMany({
    where: { company_size: { in: bands } },
    select: { igrp: true, dim_scores: true },
  });

  if (snapshots.length < SIZE_MIN_COMPANIES) {
    return NextResponse.json({
      available: false,
      reason: 'insufficient_data',
      count: snapshots.length,
      min_required: SIZE_MIN_COMPANIES,
    });
  }

  companySizeBand = bands.length === 1 ? bands[0] : bands.join('+');

  const igrpValues = snapshots.map((s) => Number(s.igrp)).sort((a, b) => a - b);
  const mid = Math.floor(igrpValues.length / 2);
  const medianIgrp = igrpValues.length % 2 !== 0
    ? igrpValues[mid]
    : (igrpValues[mid - 1] + igrpValues[mid]) / 2;

  const dimMedians: Record<string, number> = {};
  for (const key of DIM_KEYS) {
    const vals = snapshots
      .map((s) => (s.dim_scores as Record<string, number>)[key])
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b);
    if (vals.length === 0) { dimMedians[key] = 0; continue; }
    const m = Math.floor(vals.length / 2);
    dimMedians[key] = vals.length % 2 !== 0 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  }

  return NextResponse.json({
    available: true,
    company_size: companySizeBand,
    company_size_label: COMPANY_SIZE_LABELS[companySizeBand] ?? companySizeBand,
    count: snapshots.length,
    median_igrp: Number(medianIgrp.toFixed(2)),
    dim_medians: dimMedians,
  });
}
