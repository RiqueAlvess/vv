import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser, hashPassword } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { userSchema } from '@/lib/validations';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * pageLimit;

    const supabase = createServerClient();

    let query = supabase
      .from('core.users')
      .select('id, name, email, role, company_id, sector_id, active, created_at', { count: 'exact' })
      .eq('active', true);

    // RH sees only users from their company
    if (user.role === 'RH') {
      query = query.eq('company_id', user.company_id);
    } else if (user.role === 'LIDERANCA') {
      query = query.eq('company_id', user.company_id);
    }
    // ADM sees all users

    const { data: users, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageLimit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit: pageLimit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageLimit),
      },
    });
  } catch (err) {
    console.error('List users error:', err);
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

    // ADM can create any user; RH can create users for their own company
    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = userSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, role, company_id } = parsed.data;

    // RH can only create users for their own company
    if (user.role === 'RH' && company_id !== user.company_id) {
      return NextResponse.json(
        { error: 'Você só pode criar usuários para sua própria empresa' },
        { status: 403 }
      );
    }

    // RH cannot create ADM users
    if (user.role === 'RH' && role === 'ADM') {
      return NextResponse.json(
        { error: 'Você não pode criar usuários administradores' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();

    // Check email uniqueness
    const { data: existing } = await supabase
      .from('core.users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const { data: newUser, error } = await supabase
      .from('core.users')
      .insert({
        name,
        email,
        password_hash: passwordHash,
        role,
        company_id,
        active: true,
      })
      .select('id, name, email, role, company_id, active, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
