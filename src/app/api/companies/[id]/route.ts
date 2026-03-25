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

    // ADM can see any company; others can only see their own
    if (user.role !== 'ADM' && user.company_id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerClient();

    const { data: company, error } = await supabase
      .from('core.companies')
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .single();

    if (error || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(company);
  } catch (err) {
    console.error('Get company error:', err);
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

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createServerClient();

    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.cnpj) updateData.cnpj = body.cnpj;
    if (body.cnae !== undefined) updateData.cnae = body.cnae;
    updateData.updated_at = new Date().toISOString();

    const { data: company, error } = await supabase
      .from('core.companies')
      .update(updateData)
      .eq('id', id)
      .eq('active', true)
      .select()
      .single();

    if (error || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(company);
  } catch (err) {
    console.error('Update company error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    const { data: company, error } = await supabase
      .from('core.companies')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('active', true)
      .select()
      .single();

    if (error || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Empresa desativada com sucesso' });
  } catch (err) {
    console.error('Delete company error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
