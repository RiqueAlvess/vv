import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { getCompanySizeBand } from '@/lib/company-size';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'ADM') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all closed campaigns that have metrics
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'closed', metrics: { isNot: null } },
    select: {
      id: true,
      metrics: { select: { igrp: true, dimension_scores: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const campaign of campaigns) {
    if (!campaign.metrics?.igrp) { skipped++; continue; }

    const employeeCount = await prisma.campaignEmployee.count({
      where: { campaign_id: campaign.id },
    });
    if (employeeCount === 0) { skipped++; continue; }

    const sizeBand = getCompanySizeBand(employeeCount);
    const igrp = Number(campaign.metrics.igrp);

    // Extract dim NR values from stored dimension_scores
    // dimension_scores is stored as an array of { key, nr, ... }
    const dimArr = Array.isArray(campaign.metrics.dimension_scores)
      ? (campaign.metrics.dimension_scores as { key: string; nr: number }[])
      : [];
    const dimScores = Object.fromEntries(dimArr.map((d) => [d.key, d.nr]));

    await prisma.benchmarkSnapshot.create({
      data: { company_size: sizeBand, igrp, dim_scores: dimScores },
    });
    created++;
  }

  return NextResponse.json({
    ok: true,
    campaigns_processed: campaigns.length,
    snapshots_created: created,
    skipped,
  });
}
