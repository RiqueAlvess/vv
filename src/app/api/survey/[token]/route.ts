import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { surveyResponseSchema } from '@/lib/validations';
import { generateToken } from '@/lib/crypto';

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const supabase = createServerClient();

    const { data: invitation, error } = await supabase
      .from('core.survey_invitations')
      .select('id, campaign_id, token_used_internally, expires_at')
      .eq('token_public', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json(
        { valid: false, error: 'Token inválido' },
        { status: 404 }
      );
    }

    if (invitation.token_used_internally) {
      return NextResponse.json(
        { valid: false, error: 'Este convite já foi utilizado' },
        { status: 410 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Este convite expirou' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      campaign_id: invitation.campaign_id,
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
    const supabase = createServerClient();

    // Validate token
    const { data: invitation, error: invError } = await supabase
      .from('core.survey_invitations')
      .select('id, campaign_id, token_used_internally, expires_at')
      .eq('token_public', token)
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 404 }
      );
    }

    if (invitation.token_used_internally) {
      return NextResponse.json(
        { error: 'Este convite já foi utilizado' },
        { status: 410 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Este convite expirou' },
        { status: 410 }
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = surveyResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { responses, gender, age_range, consent_accepted } = parsed.data;

    const sessionUuid = generateToken();
    const now = new Date();

    // Create survey response
    const { error: responseError } = await supabase
      .from('core.survey_responses')
      .insert({
        campaign_id: invitation.campaign_id,
        session_uuid: sessionUuid,
        gender: gender ?? null,
        age_range: age_range ?? null,
        consent_accepted,
        consent_accepted_at: now.toISOString(),
        responses,
      });

    if (responseError) {
      console.error('Create survey response error:', responseError);
      return NextResponse.json(
        { error: 'Erro ao registrar resposta' },
        { status: 500 }
      );
    }

    // Mark token as used internally immediately
    await supabase
      .from('core.survey_invitations')
      .update({
        token_used_internally: true,
      })
      .eq('id', invitation.id);

    // Schedule delayed status update: random 1-12 hours from now
    const delayMs = Math.floor(Math.random() * 11 * 60 * 60 * 1000) + 60 * 60 * 1000;
    const scheduledAt = new Date(now.getTime() + delayMs).toISOString();

    await supabase
      .from('core.survey_invitations')
      .update({
        status_update_scheduled_at: scheduledAt,
      })
      .eq('id', invitation.id);

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
