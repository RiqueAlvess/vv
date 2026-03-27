import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

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

    const newToken = await signToken({
      user_id: user.id,
      email: user.email,
      role: user.role as 'ADM' | 'RH' | 'LIDERANCA',
      company_id: user.company_id,
    });

    const newRefreshToken = await signRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: newRefreshToken,
        expires_at: expiresAt,
      },
    });

    return NextResponse.json({
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
