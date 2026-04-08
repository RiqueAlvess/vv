import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/users/[id]/companies — list companies this user has access to */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.role !== 'ADM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const lim = apiLimiter(auth.user_id);
    if (!lim.success) return NextResponse.json({ error: 'Limite de requisições excedido' }, { status: 429 });

    const { id } = await params;

    const rows = await prisma.userCompany.findMany({
      where: { user_id: id },
      select: { company: { select: { id: true, name: true } } },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({ companies: rows.map((r) => r.company) });
  } catch (err) {
    console.error('Get user companies error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

const putSchema = z.object({
  company_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma empresa'),
});

/** PUT /api/users/[id]/companies — replace the companies this user can access */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.role !== 'ADM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const lim = apiLimiter(auth.user_id);
    if (!lim.success) return NextResponse.json({ error: 'Limite de requisições excedido' }, { status: 429 });

    const { id } = await params;

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { company_ids } = parsed.data;

    // Verify user exists
    const targetUser = await prisma.user.findUnique({
      where: { id, active: true },
      select: { id: true, company_id: true, name: true },
    });
    if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    // Ensure the primary company_id is always in the list
    const allIds = Array.from(new Set([targetUser.company_id, ...company_ids]));

    // Verify all companies exist and are active
    const validCompanies = await prisma.company.findMany({
      where: { id: { in: allIds }, active: true },
      select: { id: true },
    });
    const validIds = new Set(validCompanies.map((c) => c.id));
    const finalIds = allIds.filter((id) => validIds.has(id));

    // Sync: delete removed, create new — all in one transaction
    await prisma.$transaction([
      prisma.userCompany.deleteMany({ where: { user_id: id } }),
      prisma.userCompany.createMany({
        data: finalIds.map((company_id) => ({ user_id: id, company_id })),
        skipDuplicates: true,
      }),
    ]);

    log('AUDIT', {
      action: 'user.companies_updated',
      message: `Empresas atualizadas para: ${targetUser.name} (${finalIds.length} empresa(s))`,
      user_id: auth.user_id,
      company_id: auth.company_id,
      target_id: id,
      target_type: 'user',
      metadata: { company_ids: finalIds },
    });

    return NextResponse.json({ company_ids: finalIds });
  } catch (err) {
    console.error('Update user companies error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
