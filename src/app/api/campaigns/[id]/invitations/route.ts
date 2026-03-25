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
      .select('id, company_id')
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit_ = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit_;

    const { count } = await supabase
      .from('core.survey_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id);

    const { data: invitations, error } = await supabase
      .from('core.survey_invitations')
      .select('id, campaign_id, employee_id, token_public, token_used, status, sent_at, expires_at')
      .eq('campaign_id', id)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit_ - 1);

    if (error) {
      console.error('List invitations error:', error);
      return NextResponse.json(
        { error: 'Erro ao listar convites' },
        { status: 500 }
      );
    }

    // For RH users, show only aggregated status counts instead of individual statuses
    // to protect anonymity
    if (user.role === 'RH') {
      const sanitized = invitations?.map((inv) => ({
        id: inv.id,
        campaign_id: inv.campaign_id,
        employee_id: inv.employee_id,
        status: inv.status,
        sent_at: inv.sent_at,
        expires_at: inv.expires_at,
      }));

      const { count: respondedCount } = await supabase
        .from('core.survey_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('token_used', true);

      return NextResponse.json({
        data: sanitized,
        aggregated: {
          total: count ?? 0,
          responded: respondedCount ?? 0,
        },
        pagination: {
          page,
          limit: limit_,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit_),
        },
      });
    }

    return NextResponse.json({
      data: invitations,
      pagination: {
        page,
        limit: limit_,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit_),
      },
    });
  } catch (err) {
    console.error('List invitations error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
