import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');

  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id e obrigatorio' }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { company_id: true, name: true, status: true },
  });

  if (!campaign) return NextResponse.json({ error: 'Campanha nao encontrada' }, { status: 404 });
  if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let progress = await prisma.checklistProgress.findUnique({
    where: { campaign_id: campaignId },
    include: {
      evidences: {
        orderBy: { uploaded_at: 'desc' },
        select: {
          id: true, item_id: true, file_name: true,
          file_url: true, file_type: true, uploaded_at: true,
        },
      },
    },
  });

  if (!progress) {
    progress = await prisma.checklistProgress.create({
      data: { campaign_id: campaignId, checked_items: [] },
      include: { evidences: true },
    });
  }

  return NextResponse.json({
    id: progress.id,
    campaign_id: campaignId,
    campaign_name: campaign.name,
    campaign_status: campaign.status,
    checked_items: progress.checked_items as string[],
    evidences: progress.evidences,
    updated_at: progress.updated_at,
  });
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { campaign_id, checked_items } = body;

  if (!campaign_id) {
    return NextResponse.json({ error: 'campaign_id e obrigatorio' }, { status: 400 });
  }
  if (!Array.isArray(checked_items)) {
    return NextResponse.json({ error: 'checked_items deve ser um array' }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaign_id },
    select: { company_id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha nao encontrada' }, { status: 404 });
  if (user.role === 'RH' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const progress = await prisma.checklistProgress.upsert({
    where: { campaign_id },
    create: { campaign_id, checked_items, updated_at: new Date() },
    update: { checked_items, updated_at: new Date() },
    select: { id: true, campaign_id: true, checked_items: true, updated_at: true },
  });

  return NextResponse.json(progress);
}
