import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { surveyResponseSchema } from '@/lib/validations';
import { persistFactResponses } from '@/actions/survey.actions';
import { generateToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET — validate QR code token, return campaign info + hierarchy for self-selection
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const qrCode = await prisma.campaignQRCode.findUnique({
      where: { token },
      select: {
        id: true,
        is_active: true,
        campaign: {
          select: {
            id: true,
            status: true,
            name: true,
            company: { select: { name: true, cnpj: true } },
            units: {
              select: {
                id: true,
                name: true,
                sectors: {
                  select: {
                    id: true,
                    name: true,
                    positions: {
                      select: { id: true, name: true },
                      orderBy: { name: 'asc' },
                    },
                  },
                  orderBy: { name: 'asc' },
                },
              },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!qrCode) {
      return NextResponse.json(
        { valid: false, error: 'QR Code inválido' },
        { status: 404 }
      );
    }

    if (!qrCode.is_active) {
      return NextResponse.json(
        { valid: false, error: 'Este QR Code foi desativado' },
        { status: 410 }
      );
    }

    if (qrCode.campaign.status !== 'active') {
      return NextResponse.json(
        { valid: false, error: 'Esta campanha não está mais ativa' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      campaign_id: qrCode.campaign.id,
      campaign_name: qrCode.campaign.name,
      company_name: qrCode.campaign.company.name,
      company_cnpj: qrCode.campaign.company.cnpj,
      hierarchy: qrCode.campaign.units,
    });
  } catch (err) {
    console.error('Validate QR code error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST — submit survey response via QR code
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const body = await request.json();
    const parsed = surveyResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { responses, gender, age_range, unit_id, sector_id, position_id, fingerprint, consent_accepted } = parsed.data;

    // Validate QR code is still active and campaign is active
    const qrCode = await prisma.campaignQRCode.findUnique({
      where: { token },
      select: {
        is_active: true,
        campaign: { select: { id: true, status: true } },
      },
    });

    if (!qrCode || !qrCode.is_active) {
      return NextResponse.json(
        { error: 'QR Code inválido ou desativado' },
        { status: 410 }
      );
    }

    if (qrCode.campaign.status !== 'active') {
      return NextResponse.json(
        { error: 'Esta campanha não está aceitando respostas' },
        { status: 409 }
      );
    }

    const campaignId = qrCode.campaign.id;

    // Check fingerprint deduplication (one response per device per campaign)
    if (fingerprint) {
      const existing = await prisma.surveyResponse.findFirst({
        where: { campaign_id: campaignId, fingerprint },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Você já participou desta pesquisa neste dispositivo' },
          { status: 409 }
        );
      }
    }

    const sessionUuid = generateToken();

    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        campaign_id: campaignId,
        session_uuid: sessionUuid,
        unit_id: unit_id ?? null,
        sector_id: sector_id ?? null,
        position_id: position_id ?? null,
        fingerprint: fingerprint ?? null,
        gender: gender ?? null,
        age_range: age_range ?? null,
        consent_accepted,
        consent_accepted_at: new Date(),
        responses,
      },
      select: { id: true },
    });

    // Persist analytics fact rows — non-fatal
    try {
      await persistFactResponses(surveyResponse.id, campaignId, responses);
    } catch (error) {
      console.error('[FactResponse]', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Resposta registrada com sucesso',
    });
  } catch (err) {
    console.error('Submit survey response error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
