import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SIZE_MIN_COMPANIES = 5;

const DIM_KEYS = [
  'demandas', 'controle', 'apoio_chefia', 'apoio_colegas',
  'relacionamentos', 'cargo', 'comunicacao_mudancas',
] as const;

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id: user.company_id },
    select: { company_size: true },
  });

  if (!company?.company_size) {
    return NextResponse.json({ available: false, reason: 'company_size_not_set' });
  }

  const snapshots = await prisma.benchmarkSnapshot.findMany({
    where: { company_size: company.company_size },
    select: { igrp: true, dim_scores: true },
  });

  if (snapshots.length < SIZE_MIN_COMPANIES) {
    return NextResponse.json({
      available: false,
      reason: 'insufficient_data',
      count: snapshots.length,
      min_required: SIZE_MIN_COMPANIES,
      company_size: company.company_size,
    });
  }

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
    company_size: company.company_size,
    count: snapshots.length,
    median_igrp: Number(medianIgrp.toFixed(2)),
    dim_medians: dimMedians,
  });
}
