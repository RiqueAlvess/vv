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

    if (user.role !== 'ADM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const companies = await prisma.company.findMany({
      select: { id: true, name: true, cnpj: true },
      orderBy: { name: 'asc' },
    });

    if (!companyId) {
      return NextResponse.json({ companies });
    }

    const company = companies.find((c) => c.id === companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const [usersRaw, campaignsRaw, responseCounts] =
      await Promise.all([
        prisma.user.findMany({
          where: { company_id: companyId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            last_login_at: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.campaign.findMany({
          where: { company_id: companyId },
          select: {
            id: true,
            name: true,
            status: true,
            created_at: true,
            _count: { select: { responses: true } },
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.surveyResponse.groupBy({
          by: ['campaign_id'],
          where: { campaign: { company_id: companyId } },
          _count: { id: true },
        }),
      ]);

    const responseCountMap = new Map(
      responseCounts.map((r) => [r.campaign_id, r._count.id])
    );

    const users = usersRaw.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      last_login_at: u.last_login_at?.toISOString() ?? null,
      created_at: u.created_at.toISOString(),
    }));

    const employees: unknown[] = []; // no longer tracked in QR code model

    const campaigns = campaignsRaw.map((c) => {
      const responded = responseCountMap.get(c.id) ?? 0;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        created_at: c.created_at.toISOString(),
        total_invitations: c._count.responses,
        responded,
        pending: 0,
      };
    });

    return NextResponse.json({
      companies,
      selected: { company, users, employees, campaigns },
    });
  } catch (err) {
    console.error('Adm stats error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
