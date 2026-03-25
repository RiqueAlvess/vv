import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { signToken, signRefreshToken, comparePassword } from '@/lib/auth';
import { loginLimiter } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validations';

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

    const supabase = createServerClient();

    const { data: user, error } = await supabase
      .from('core.users')
      .select('id, name, email, password_hash, role, company_id, active')
      .eq('email', email)
      .eq('active', true)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    const validPassword = await comparePassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    const token = await signToken({
      user_id: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
    });

    const refreshToken = await signRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase.from('core.refresh_tokens').insert({
      user_id: user.id,
      token: refreshToken,
      expires_at: expiresAt.toISOString(),
    });

    const response = NextResponse.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
      },
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
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
