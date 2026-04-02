import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hashPassword, comparePassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }
    if (new_password.length < 8) {
      return NextResponse.json({ error: 'Nova senha deve ter no mínimo 8 caracteres' }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.user_id },
      select: { password_hash: true },
    });
    if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const valid = await comparePassword(current_password, dbUser.password_hash);
    if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });

    const newHash = await hashPassword(new_password);
    await prisma.user.update({
      where: { id: user.user_id },
      data: { password_hash: newHash },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
