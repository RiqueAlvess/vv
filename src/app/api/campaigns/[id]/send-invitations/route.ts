import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { generateToken } from '@/lib/crypto';

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

    const body = await request.json();
    const { employee_ids } = body;

    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
      return NextResponse.json(
        { error: 'employee_ids deve ser um array não vazio' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    let createdCount = 0;

    for (const employeeId of employee_ids) {
      const tokenPublic = generateToken();

      const { error } = await supabase
        .from('core.survey_invitations')
        .insert({
          campaign_id: id,
          employee_id: employeeId,
          token_public: tokenPublic,
          token_used: false,
          status: 'sent',
          sent_at: now.toISOString(),
          expires_at: expiresAt,
        });

      if (error) {
        console.error('Create invitation error:', error);
        continue;
      }

      createdCount++;
    }

    return NextResponse.json({
      created: createdCount,
      total_requested: employee_ids.length,
    });
  } catch (err) {
    console.error('Send invitations error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
