import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashCpf } from '@/lib/crypto';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const TOKEN_TTL_MINUTES = 30;

// POST — validate employee CPF and issue a one-use validation_token
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const body = await request.json();
    const cpf: string = typeof body.cpf === 'string' ? body.cpf.trim() : '';

    if (!cpf) {
      return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 });
    }

    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });
    }

    // Verify QR code and campaign
    const qrCode = await prisma.campaignQRCode.findUnique({
      where: { token },
      select: {
        is_active: true,
        campaign: {
          select: { id: true, status: true, campaign_salt: true },
        },
      },
    });

    if (!qrCode || !qrCode.is_active) {
      return NextResponse.json({ error: 'QR Code inválido ou desativado' }, { status: 410 });
    }

    if (qrCode.campaign.status !== 'active') {
      return NextResponse.json({ error: 'Esta campanha não está aceitando respostas' }, { status: 409 });
    }

    const campaignId = qrCode.campaign.id;
    const cpfHash = hashCpf(cpf, qrCode.campaign.campaign_salt);

    // Find employee by cpf_hash — also fetch position to pre-suggest hierarchy on survey
    const employee = await prisma.campaignEmployee.findFirst({
      where: { campaign_id: campaignId, cpf_hash: cpfHash },
      select: {
        id: true,
        has_responded: true,
        position: {
          select: {
            id: true,
            sector: {
              select: {
                id: true,
                unit_id: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'CPF não encontrado. Verifique se você está cadastrado nesta campanha.' },
        { status: 404 }
      );
    }

    if (employee.has_responded) {
      return NextResponse.json(
        { error: 'Este CPF já respondeu à pesquisa. Cada colaborador pode responder apenas uma vez.' },
        { status: 409 }
      );
    }

    // Issue validation_token (UUID, 30-minute TTL)
    const validationToken = randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.campaignEmployee.update({
      where: { id: employee.id },
      data: {
        validation_token: validationToken,
        validation_token_expires_at: expiresAt,
      },
    });

    return NextResponse.json({
      validation_token: validationToken,
      suggested_unit_id: employee.position?.sector?.unit_id ?? null,
      suggested_sector_id: employee.position?.sector?.id ?? null,
      suggested_position_id: employee.position?.id ?? null,
    });
  } catch (err) {
    console.error('Validate CPF error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
