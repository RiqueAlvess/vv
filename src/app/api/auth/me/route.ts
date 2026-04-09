import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

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

    const userData = await prisma.user.findUnique({
      where: { id: user.user_id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        company_id: true,
        sector_id: true,
        active: true,
        created_at: true,
        user_companies: {
          select: {
            company: { select: { id: true, name: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!userData) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const companies = userData.user_companies.length > 0
      ? userData.user_companies.map((uc) => uc.company)
      : [{ id: userData.company_id, name: '' }];

    // Use the active company_id from the JWT (may differ from DB primary after company switch)
    const activeCompanyId = user.company_id;

    const activeCompany = await prisma.company.findUnique({
      where: { id: activeCompanyId },
      select: { id: true, name: true, cnpj: true, cnae: true, logo_url: true },
    });

    return NextResponse.json({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      company_id: activeCompanyId,
      sector_id: userData.sector_id,
      active: userData.active,
      created_at: userData.created_at,
      company: activeCompany,
      companies,
    });
  } catch (err) {
    console.error('Get me error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
