import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

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

    const [usersRaw, invitationsRaw, campaignsRaw, respondedCounts] =
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
        prisma.surveyInvitation.findMany({
          where: { campaign: { company_id: companyId } },
          select: {
            id: true,
            status: true,
            employee: {
              select: {
                email_hash: true,
                position: {
                  select: {
                    name: true,
                    sector: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.campaign.findMany({
          where: { company_id: companyId },
          select: {
            id: true,
            name: true,
            status: true,
            created_at: true,
            _count: { select: { invitations: true } },
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.surveyInvitation.groupBy({
          by: ['campaign_id', 'status'],
          where: { campaign: { company_id: companyId } },
          _count: { id: true },
        }),
      ]);

    // Build responded/pending counts per campaign
    const campaignStatusMap = new Map<
      string,
      { responded: number; pending: number }
    >();
    for (const row of respondedCounts) {
      if (!campaignStatusMap.has(row.campaign_id)) {
        campaignStatusMap.set(row.campaign_id, { responded: 0, pending: 0 });
      }
      const entry = campaignStatusMap.get(row.campaign_id)!;
      if (row.status === 'responded') entry.responded += row._count.id;
      if (row.status === 'pending') entry.pending += row._count.id;
    }

    const users = usersRaw.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      last_login_at: u.last_login_at?.toISOString() ?? null,
      created_at: u.created_at.toISOString(),
    }));

    const employees = invitationsRaw.map((inv) => ({
      id: inv.id,
      employee_name: null as string | null,
      employee_email: inv.employee.email_hash,
      department: inv.employee.position?.sector?.name ?? null,
      position: inv.employee.position?.name ?? null,
      status: inv.status,
    }));

    const campaigns = campaignsRaw.map((c) => {
      const counts = campaignStatusMap.get(c.id) ?? {
        responded: 0,
        pending: 0,
      };
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        created_at: c.created_at.toISOString(),
        total_invitations: c._count.invitations,
        responded: counts.responded,
        pending: counts.pending,
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
