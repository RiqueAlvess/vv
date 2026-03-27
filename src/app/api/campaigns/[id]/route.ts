import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429 }
      );
    }

    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    // Non-ADM users can only see campaigns from their own company
    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get hierarchy counts
    const [unitsCount, sectorsCount, positionsCount] = await Promise.all([
      prisma.campaignUnit.count({
        where: { campaign_id: id },
      }),
      prisma.campaignSector.count({
        where: { unit: { campaign_id: id } },
      }),
      prisma.campaignPosition.count({
        where: { sector: { unit: { campaign_id: id } } },
      }),
    ]);

    return NextResponse.json({
      ...campaign,
      counts: {
        units: unitsCount,
        sectors: sectorsCount,
        positions: positionsCount,
      },
    });
  } catch (err) {
    console.error('Get campaign error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get existing campaign
    const existing = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Só é possível editar campanhas em rascunho' },
        { status: 400 }
      );
    }

    if (user.role !== 'ADM' && existing.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.start_date) {
      updateData.start_date = body.start_date.includes('T')
        ? body.start_date
        : `${body.start_date}T00:00:00.000Z`;
    }
    if (body.end_date) {
      updateData.end_date = body.end_date.includes('T')
        ? body.end_date
        : `${body.end_date}T23:59:59.000Z`;
    }
    updateData.updated_at = new Date();

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(campaign);
  } catch (err) {
    console.error('Update campaign error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
