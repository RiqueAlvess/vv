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
          company: { select: { id: true, name: true } },
          user_companies: { select: { company: { select: { id: true, name: true } } } },
          sector_id: true,
          active: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageLimit,
      }),
      prisma.user.count({ where }),
    ]);

    const normalizedUsers = users.map(({ company, user_companies, ...u }) => ({
      ...u,
      company_name: company.name,
      companies: user_companies.length > 0
        ? user_companies.map((uc) => uc.company)
        : [{ id: company.id, name: company.name }],
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

    const { name, email, password, role, company_id, company_ids } = parsed.data;

    // Resolve the full list of companies: use company_ids if provided, else fallback to [company_id]
    const allCompanyIds = company_ids && company_ids.length > 0 ? company_ids : [company_id];
    // Primary company is always the first in the list
    const primaryCompanyId = allCompanyIds[0];

    // RH can only create users for their own company
    if (user.role === 'RH' && !allCompanyIds.includes(user.company_id)) {
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

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: passwordHash,
        role,
        company_id: primaryCompanyId,
        active: true,
        user_companies: {
          create: allCompanyIds.map((cid) => ({ company_id: cid })),
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
        user_companies: { select: { company: { select: { id: true, name: true } } } },
      },
    });

    log('AUDIT', {
      action: 'user.create',
      message: `Usuário criado: ${newUser.name} (${newUser.role})`,
      user_id: user.user_id,
      user_email: user.email,
      company_id: newUser.company_id,
      target_id: newUser.id,
      target_type: 'user',
      metadata: { name: newUser.name, role: newUser.role, email: newUser.email, company_ids: allCompanyIds },
    });

    const { user_companies, ...rest } = newUser;
    return NextResponse.json({
      ...rest,
      companies: user_companies.map((uc) => uc.company),
    }, { status: 201 });
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
