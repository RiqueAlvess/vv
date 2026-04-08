import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, signToken, signRefreshToken } from '@/lib/auth';
import { log } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const switchSchema = z.object({
  company_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'company_id inválido' }, { status: 400 });
    }

    const { company_id } = parsed.data;

    // Verify the user actually has access to this company
    const access = await prisma.userCompany.findUnique({
      where: { user_id_company_id: { user_id: user.user_id, company_id } },
      select: { company: { select: { id: true, name: true, active: true } } },
    });

    if (!access || !access.company.active) {
      return NextResponse.json({ error: 'Acesso negado a esta empresa' }, { status: 403 });
    }

    // Persist selected company as the new default/primary company for this user.
    await prisma.user.update({
      where: { id: user.user_id },
      data: { company_id },
    });

    // Re-issue tokens with new company_id
    const token = await signToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      company_id,
    });

    const refreshToken = await signRefreshToken(user.user_id, company_id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Invalidate all existing refresh tokens for this user (they had a different company context)
    await prisma.refreshToken.deleteMany({ where: { user_id: user.user_id } });

    await prisma.refreshToken.create({
      data: { user_id: user.user_id, token: refreshToken, expires_at: expiresAt },
    });

    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';

    log('AUDIT', {
      action: 'user.switch_company',
      message: `Empresa alterada para: ${access.company.name}`,
      user_id: user.user_id,
      company_id,
      ip,
      metadata: { previous_company_id: user.company_id, new_company_id: company_id },
    });

    const response = NextResponse.json({
      token,
      company: access.company,
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('Switch company error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
