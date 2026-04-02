import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { company_id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const units = await prisma.campaignUnit.findMany({
    where: { campaign_id: id },
    select: {
      id: true,
      name: true,
      sectors: {
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: units });
}
