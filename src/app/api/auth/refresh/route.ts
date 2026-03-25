import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
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

    const supabase = createServerClient();

    const { data: storedToken, error: tokenError } = await supabase
      .from('core.refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .eq('user_id', payload.user_id)
      .single();

    if (tokenError || !storedToken) {
      return NextResponse.json(
        { error: 'Refresh token não encontrado' },
        { status: 401 }
      );
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      await supabase
        .from('core.refresh_tokens')
        .delete()
        .eq('id', storedToken.id);

      return NextResponse.json(
        { error: 'Refresh token expirado' },
        { status: 401 }
      );
    }

    // Delete old refresh token
    await supabase
      .from('core.refresh_tokens')
      .delete()
      .eq('id', storedToken.id);

    // Get user data for new access token
    const { data: user, error: userError } = await supabase
      .from('core.users')
      .select('id, email, role, company_id')
      .eq('id', payload.user_id)
      .eq('active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 401 }
      );
    }

    const newToken = await signToken({
      user_id: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
    });

    const newRefreshToken = await signRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase.from('core.refresh_tokens').insert({
      user_id: user.id,
      token: newRefreshToken,
      expires_at: expiresAt.toISOString(),
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
