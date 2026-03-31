import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { surveyResponseSchema } from '@/lib/validations';
import { AnonymityService } from '@/services/anonymity.service';

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const invitation = await prisma.surveyInvitation.findUnique({
      where: { token_public: token },
      select: {
        id: true,
        campaign_id: true,
        token_used_internally: true,
        expires_at: true,
        campaign: { select: { status: true, name: true, company: { select: { name: true, cnpj: true } } } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { valid: false, error: 'Link inválido ou já utilizado' },
        { status: 404 }
      );
    }

    if (invitation.token_used_internally) {
      return NextResponse.json(
        { valid: false, error: 'Este convite já foi utilizado' },
        { status: 410 }
      );
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Este convite expirou' },
        { status: 410 }
      );
    }

    if (invitation.campaign.status !== 'active') {
      return NextResponse.json(
        { valid: false, error: 'Esta campanha não está mais ativa' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      campaign_id: invitation.campaign_id,
      campaign_name: invitation.campaign.name,
      company_name: invitation.campaign.company.name,
      company_cnpj: invitation.campaign.company.cnpj,
    });
  } catch (err) {
    console.error('Validate survey token error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    // Validate body before opening the transaction — request.json() is one-shot
    const body = await request.json();
    const parsed = surveyResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { responses, gender, age_range, consent_accepted } = parsed.data;

    // Blind Drop Protocol Steps 3 & 4 — atomic: token consumption + response insert.
    // If the INSERT fails the transaction rolls back, so the token is never consumed.
    let session: { sessionUuid: string; campaignId: string; invitationId: string } | null;
    try {
      session = await prisma.$transaction(async (tx) => {
        const s = await AnonymityService.validateAndDestroyToken(token, tx);
        if (!s) return null;

        const anonymousData = AnonymityService.buildAnonymousResponse(
          s.campaignId,
          s.sessionUuid,
          responses,
          { gender, ageRange: age_range },
          consent_accepted
        );

        await tx.surveyResponse.create({ data: anonymousData });
        return s;
      });
    } catch (txErr) {
      if (txErr instanceof Error && txErr.message === 'Campaign is not active') {
        return NextResponse.json(
          { error: 'This survey is no longer accepting responses' },
          { status: 409 }
        );
      }
      throw txErr;
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Token inválido, expirado ou já utilizado' },
        { status: 410 }
      );
    }

    // Blind Drop Protocol Step 5: Schedule delayed status update (outside transaction)
    const delayMs = AnonymityService.calculateRandomDelay();
    await AnonymityService.scheduleStatusUpdate(session.invitationId, delayMs);

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
