import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerClient();

    const { data: campaign } = await supabase
      .from('core.campaigns')
      .select('id, company_id, status')
      .eq('id', id)
      .single();

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Apenas campanhas em rascunho podem ser ativadas' },
        { status: 400 }
      );
    }

    const { count: invitationCount } = await supabase
      .from('core.survey_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .eq('status', 'sent');

    if (!invitationCount || invitationCount === 0) {
      return NextResponse.json(
        { error: 'É necessário ter pelo menos 1 convite enviado para ativar a campanha' },
        { status: 400 }
      );
    }

    const { data: updatedCampaign, error } = await supabase
      .from('core.campaigns')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Activate campaign error:', error);
      return NextResponse.json(
        { error: 'Erro ao ativar campanha' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedCampaign);
  } catch (err) {
    console.error('Activate campaign error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
