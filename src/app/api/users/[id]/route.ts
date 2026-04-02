import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hashPassword } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
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

    const { id } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id, active: true },
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
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Non-ADM users can only see users from their own company
    if (user.role !== 'ADM' && targetUser.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(targetUser);
  } catch (err) {
    console.error('Get user error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Users can update themselves (limited fields) or ADM can update anyone
    const isSelf = user.user_id === id;
    if (!isSelf && user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (isSelf && user.role !== 'ADM') {
      // Self-update: limited fields
      if (body.name) updateData.name = body.name;
      if (body.password) updateData.password_hash = await hashPassword(body.password);
    } else {
      // ADM update: all fields
      if (body.name) updateData.name = body.name;
      if (body.email) updateData.email = body.email;
      if (body.password) updateData.password_hash = await hashPassword(body.password);
      if (body.role) updateData.role = body.role;
      if (body.company_id) updateData.company_id = body.company_id;
      if (body.sector_id !== undefined) updateData.sector_id = body.sector_id;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
    }

    // Verify user exists and is active before updating
    const existing = await prisma.user.findUnique({
      where: { id, active: true },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
    });

    return NextResponse.json(updatedUser);
  } catch (err) {
    console.error('Update user error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Verify user exists and is active before soft-deleting
    const existing = await prisma.user.findUnique({
      where: { id, active: true },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ message: 'Usuário desativado com sucesso' });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
