import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== 'ADM') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const page     = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const pageSize = 20;
  const search   = url.searchParams.get('q')?.trim() ?? '';
  const minInt   = parseInt(url.searchParams.get('min_interest') ?? '0');

  const where = {
    ...(search ? {
      OR: [
        { name:         { contains: search, mode: 'insensitive' as const } },
        { email:        { contains: search, mode: 'insensitive' as const } },
        { company_name: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(minInt > 0 ? { interest: { gte: minInt } } : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.trialLead.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, phone: true,
        company_name: true, company_size: true, sector: true, role: true,
        pain_points: true, interest: true, message: true, created_at: true,
      },
    }),
    prisma.trialLead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, pageSize });
}
