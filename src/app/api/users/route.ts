import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hashPassword } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { userSchema } from '@/lib/validations';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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
    const search = searchParams.get('search')?.trim() ?? '';

    const where: Record<string, unknown> = { active: true };

    // RH sees only users from their company
    if (user.role === 'RH') {
      where.company_id = user.company_id;
    } else if (user.role === 'LIDERANCA') {
      where.company_id = user.company_id;
    }
    // ADM sees all users

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          company_id: true,
          company: { select: { name: true } },
          sector_id: true,
          active: true,
          created_at: true,
          _count: { select: { user_companies: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageLimit,
      }),
      prisma.user.count({ where }),
    ]);

    const normalizedUsers = users.map(({ company, _count, ...u }) => ({
      ...u,
      company_name: company.name,
      company_count: _count.user_companies,
    }));

    return NextResponse.json({
      data: normalizedUsers,
      pagination: {
        page,
        limit: pageLimit,
        total: count,
        totalPages: Math.ceil(count / pageLimit),
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
  let user: Awaited<ReturnType<typeof getAuthUser>> = null;
  try {
    user = await getAuthUser(request);
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
    const extra_company_ids: string[] = Array.isArray(body.extra_company_ids)
      ? body.extra_company_ids.filter((id: unknown) => typeof id === 'string')
      : [];

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

    // Check email uniqueness
    const existing = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Build the full list of company IDs (primary + extras)
    const allCompanyIds = Array.from(new Set([company_id, ...extra_company_ids]));

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: passwordHash,
        role,
        company_id,
        active: true,
        user_companies: {
          createMany: {
            data: allCompanyIds.map((cid) => ({ company_id: cid })),
            skipDuplicates: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        company_id: true,
        active: true,
        created_at: true,
      },
    });

    log('AUDIT', {
      action: 'user.create',
      message: `Usuário criado: ${newUser.name} (${newUser.role})`,
      user_id: user.user_id,
      company_id: newUser.company_id,
      target_id: newUser.id,
      target_type: 'user',
      metadata: { name: newUser.name, role: newUser.role, email: newUser.email, company_count: allCompanyIds.length },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    console.error('Create user error:', err);
    log('ERROR', {
      action: 'user.create',
      message: `Erro ao criar usuário: ${err instanceof Error ? err.message : String(err)}`,
      user_id: user?.user_id,
    });
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
