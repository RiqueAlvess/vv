import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET — list QR codes for a campaign
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { company_id: true, status: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const qrCodes = await prisma.campaignQRCode.findMany({
      where: { campaign_id: id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        token: true,
        is_active: true,
        created_at: true,
        deactivated_at: true,
      },
    });

    return NextResponse.json({ data: qrCodes });
  } catch (err) {
    console.error('List QR codes error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST — create a new QR code (deactivates any existing active ones)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { company_id: true, status: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (campaign.status === 'closed') {
      return NextResponse.json(
        { error: 'Não é possível criar QR code para uma campanha encerrada' },
        { status: 409 }
      );
    }

    const now = new Date();

    // Deactivate all existing active QR codes, then create a new one
    const qrCode = await prisma.$transaction(async (tx) => {
      await tx.campaignQRCode.updateMany({
        where: { campaign_id: id, is_active: true },
        data: { is_active: false, deactivated_at: now },
      });

      return tx.campaignQRCode.create({
        data: { campaign_id: id },
        select: {
          id: true,
          token: true,
          is_active: true,
          created_at: true,
          deactivated_at: true,
        },
      });
    });

    return NextResponse.json({ data: qrCode }, { status: 201 });
  } catch (err) {
    console.error('Create QR code error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE — deactivate a specific QR code by token (pass token in body)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { company_id: true, status: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { qr_id } = body as { qr_id: string };

    if (!qr_id) {
      return NextResponse.json({ error: 'qr_id é obrigatório' }, { status: 400 });
    }

    await prisma.campaignQRCode.updateMany({
      where: { id: qr_id, campaign_id: id },
      data: { is_active: false, deactivated_at: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete QR code error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
