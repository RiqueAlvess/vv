import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyFilter = user.role !== 'ADM' ? { company_id: user.company_id } : {};

  const campaigns = await prisma.campaign.findMany({
    where: { status: 'closed', ...companyFilter },
    select: {
      id: true,
      name: true,
      end_date: true,
      campaign_type: true,
      metrics: { select: { igrp: true, calculated_at: true } },
    },
    orderBy: { end_date: 'asc' },
  });

  const points = campaigns
    .filter((c) => c.metrics?.igrp != null)
    .map((c) => ({
      campaign_id: c.id,
      campaign_name: c.name,
      end_date: c.end_date,
      campaign_type: c.campaign_type ?? 'full',
      igrp: Number(c.metrics!.igrp),
    }));

  return NextResponse.json(points);
}
