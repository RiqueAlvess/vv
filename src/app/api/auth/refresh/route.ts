import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getRefreshTokenFromCookies(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...rest] = c.trim().split('=');
      return [key.trim(), rest.join('=')];
    })
  );
  return cookies.refreshToken ?? null;
}

export async function POST(request: Request) {
  try {
    // Try body first (backwards compat), fall back to httpOnly cookie
    let refreshToken: string | null = null;
    try {
      const body = await request.json();
      refreshToken = body.refreshToken ?? null;
    } catch {
      // No body or invalid JSON — read from cookie
    }

    if (!refreshToken) {
      refreshToken = getRefreshTokenFromCookies(request);
    }

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token é obrigatório' },
        { status: 400 }
      );
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { error: 'Refresh token inválido' },
        { status: 401 }
      );
    }

    const storedToken = await prisma.refreshToken.findFirst({
      where: { token: refreshToken, user_id: payload.user_id },
    });

    if (!storedToken) {
      return NextResponse.json(
        { error: 'Refresh token não encontrado' },
        { status: 401 }
      );
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });

      return NextResponse.json(
        { error: 'Refresh token expirado' },
        { status: 401 }
      );
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Get user data for new access token
    const user = await prisma.user.findFirst({
      where: { id: payload.user_id, active: true },
      select: { id: true, email: true, role: true, company_id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 401 }
      );
    }

    // Preserve the switched company_id from the refresh token payload;
    // fall back to the user's primary company_id if not present.
    const activeCompanyId = payload.company_id ?? user.company_id;

    const newToken = await signToken({
      user_id: user.id,
      email: user.email,
      role: user.role as 'ADM' | 'RH',
      company_id: activeCompanyId,
    });

    const newRefreshToken = await signRefreshToken(user.id, activeCompanyId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: newRefreshToken,
        expires_at: expiresAt,
      },
    });

    const response = NextResponse.json({
      token: newToken,
      refreshToken: newRefreshToken,
    });

    // Update httpOnly cookies so subsequent requests use the refreshed tokens
    response.cookies.set('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });
    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('Refresh token error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
