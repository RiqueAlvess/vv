import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hashPassword } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { userSchema } from '@/lib/validations';

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

    const where: Record<string, unknown> = { active: true };

    // RH sees only users from their company
    if (user.role === 'RH') {
      where.company_id = user.company_id;
    } else if (user.role === 'LIDERANCA') {
      where.company_id = user.company_id;
    }
    // ADM sees all users

    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          company_id: true,
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

    return NextResponse.json({
      data: users,
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
        company_id,
        active: true,
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

    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
