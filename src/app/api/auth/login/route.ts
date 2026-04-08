import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, signRefreshToken, comparePassword } from '@/lib/auth';
import { loginLimiter } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validations';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const limiterKey = `${email}:${ip}`;
    const limit = loginLimiter(limiterKey);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas de login. Tente novamente em 1 minuto.' },
        { status: 429 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email, active: true },
      select: { id: true, name: true, email: true, password_hash: true, role: true, company_id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    const validPassword = await comparePassword(password, user.password_hash);
    if (!validPassword) {
      log('WARN', {
        action: 'user.login_failed',
        message: `Tentativa de login com senha incorreta para ${email}`,
        user_id: user.id,
        company_id: user.company_id,
        ip,
        metadata: { email },
      });
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Fetch all companies this user has access to
    const userCompanies = await prisma.userCompany.findMany({
      where: { user_id: user.id },
      select: { company: { select: { id: true, name: true, active: true } } },
      orderBy: { created_at: 'asc' },
    });

    // Filter active companies; fall back to the user's primary company_id if table is empty
    const companies = userCompanies
      .filter((uc) => uc.company.active)
      .map((uc) => ({ id: uc.company.id, name: uc.company.name }));

    if (companies.length === 0) {
      companies.push({ id: user.company_id, name: '' });
    }

    // Use the first (primary) company for the initial token
    const activeCompanyId = companies[0].id;

    const token = await signToken({
      user_id: user.id,
      email: user.email,
      role: user.role as 'ADM' | 'RH' | 'LIDERANCA',
      company_id: activeCompanyId,
    });

    const refreshToken = await signRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: refreshToken,
        expires_at: expiresAt,
      },
    });

    // Fire-and-forget: update last login timestamp — non-blocking
    prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } }).catch(() => {});

    log('AUDIT', {
      action: 'user.login',
      message: `Login realizado: ${user.name} (${user.role})`,
      user_id: user.id,
      company_id: activeCompanyId,
      ip,
      metadata: { email, role: user.role },
    });

    const response = NextResponse.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: activeCompanyId,
      },
      companies,
      needs_company_select: companies.length > 1,
    });

    // Set cookies for middleware auth check
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    log('ERROR', {
      action: 'user.login',
      message: `Erro interno no login: ${err instanceof Error ? err.message : String(err)}`,
    });
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
