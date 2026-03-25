import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const limit = apiLimiter(ip);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em breve.' },
        { status: 429 }
      );
    }

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { count: totalInvited } = await supabase
      .from('core.survey_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id);

    const { count: totalResponded } = await supabase
      .from('core.survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id);

    const invited = totalInvited ?? 0;
    const responded = totalResponded ?? 0;
    const responseRate = invited > 0 ? Math.round((responded / invited) * 10000) / 100 : 0;

    // For active campaigns, only show aggregated totals
    // Don't expose individual invitation statuses to RH
    return NextResponse.json({
      campaign_id: id,
      status: campaign.status,
      total_invited: invited,
      total_responded: responded,
      response_rate: responseRate,
    });
  } catch (err) {
    console.error('Metrics error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
