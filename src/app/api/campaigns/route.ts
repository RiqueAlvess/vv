import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';
import { campaignSchema } from '@/lib/validations';
import { generateSalt } from '@/lib/crypto';

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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * pageLimit;
    const search = searchParams.get('search')?.trim() ?? '';

    const baseWhere = user.role !== 'ADM' ? { company_id: user.company_id } : {};
    const where = search
      ? { ...baseWhere, name: { contains: search, mode: 'insensitive' as const } }
      : baseWhere;

    const [campaigns, count] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageLimit,
      }),
      prisma.campaign.count({ where }),
    ]);

    return NextResponse.json({
      data: campaigns,
      pagination: {
        page,
        limit: pageLimit,
        total: count,
        totalPages: Math.ceil(count / pageLimit),
      },
    });
  } catch (err) {
    console.error('List campaigns error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = campaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, description, start_date, end_date, company_id } = parsed.data;

    // RH can only create campaigns for their own company
    if (user.role === 'RH' && company_id !== user.company_id) {
      return NextResponse.json(
        { error: 'Você só pode criar campanhas para sua própria empresa' },
        { status: 403 }
      );
    }

    const campaignSalt = generateSalt();

    const campaign = await prisma.campaign.create({
      data: {
        company_id,
        name,
        description: description ?? null,
        start_date,
        end_date,
        status: 'draft',
        campaign_salt: campaignSalt,
        created_by: user.user_id,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error('Create campaign error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
