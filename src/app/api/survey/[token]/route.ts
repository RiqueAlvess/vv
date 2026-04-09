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
            company: { select: { name: true, cnpj: true, logo_url: true } },
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
      company_logo_url: qrCode.campaign.company.logo_url ?? null,
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

    const { responses, gender, age_range, unit_id, sector_id, position_id, validation_token, consent_accepted } = parsed.data;

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

    const employee = await prisma.campaignEmployee.findFirst({
      where: {
        campaign_id: campaignId,
        validation_token: validation_token,
        has_responded: false,
      },
      select: { id: true, validation_token_expires_at: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Token de acesso inválido. Por favor, insira seu CPF novamente.' },
        { status: 401 }
      );
    }

    if (employee.validation_token_expires_at && employee.validation_token_expires_at < new Date()) {
      return NextResponse.json(
        { error: 'Seu token de acesso expirou. Por favor, insira seu CPF novamente.' },
        { status: 401 }
      );
    }

    const sessionUuid = generateToken();

    const [, surveyResponse] = await prisma.$transaction([
      prisma.campaignEmployee.update({
        where: { id: employee.id },
        data: {
          has_responded: true,
          cpf_hash: null,
          validation_token: null,
          validation_token_expires_at: null,
        },
      }),
      prisma.surveyResponse.create({
        data: {
          campaign_id: campaignId,
          session_uuid: sessionUuid,
          unit_id: unit_id ?? null,
          sector_id: sector_id ?? null,
          position_id: position_id ?? null,
          gender: gender ?? null,
          age_range: age_range ?? null,
          consent_accepted,
          consent_accepted_at: new Date(),
          responses,
        },
        select: { id: true },
      }),
    ]);

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
