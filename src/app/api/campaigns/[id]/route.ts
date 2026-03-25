import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
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
    const supabase = createServerClient();

    const { data: campaign, error } = await supabase
      .from('core.campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !campaign) {
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
    const { count: unitsCount } = await supabase
      .from('core.campaign_units')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id);

    const { count: sectorsCount } = await supabase
      .from('core.campaign_sectors')
      .select('id, unit_id!inner(*)', { count: 'exact', head: true })
      .eq('unit_id.campaign_id', id);

    const { count: positionsCount } = await supabase
      .from('core.campaign_positions')
      .select('id, sector_id!inner(unit_id!inner(*))', { count: 'exact', head: true })
      .eq('sector_id.unit_id.campaign_id', id);

    return NextResponse.json({
      ...campaign,
      counts: {
        units: unitsCount ?? 0,
        sectors: sectorsCount ?? 0,
        positions: positionsCount ?? 0,
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
    const supabase = createServerClient();

    // Get existing campaign
    const { data: existing, error: fetchError } = await supabase
      .from('core.campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
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
    if (body.start_date) updateData.start_date = body.start_date;
    if (body.end_date) updateData.end_date = body.end_date;
    updateData.updated_at = new Date().toISOString();

    const { data: campaign, error } = await supabase
      .from('core.campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (err) {
    console.error('Update campaign error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
