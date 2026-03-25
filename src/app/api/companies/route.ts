import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { companySchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * pageLimit;

    const supabase = createServerClient();

    const { count } = await supabase
      .from('core.companies')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    const { data: companies, error } = await supabase
      .from('core.companies')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageLimit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: companies,
      pagination: {
        page,
        limit: pageLimit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageLimit),
      },
    });
  } catch (err) {
    console.error('List companies error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = companySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, cnpj, cnae } = parsed.data;
    const supabase = createServerClient();

    // Check CNPJ uniqueness
    const { data: existing } = await supabase
      .from('core.companies')
      .select('id')
      .eq('cnpj', cnpj)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'CNPJ já cadastrado' },
        { status: 409 }
      );
    }

    const { data: company, error } = await supabase
      .from('core.companies')
      .insert({ name, cnpj, cnae: cnae ?? null, active: true })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    console.error('Create company error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
