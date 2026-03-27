import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { company_id: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role !== 'ADM' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const units = await prisma.campaignUnit.findMany({
      where: { campaign_id: campaignId },
      select: {
        id: true,
        name: true,
        sectors: {
          select: {
            id: true,
            name: true,
            positions: {
              select: {
                id: true,
                name: true,
                employees: {
                  select: {
                    id: true,
                    email_hash: true,
                    email_encrypted: true,
                    invitations: {
                      select: { id: true, status: true, sent_at: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform: never expose email_encrypted value, only presence as boolean
    const result = units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      sectors: unit.sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        positions: sector.positions.map((position) => ({
          id: position.id,
          name: position.name,
          employees: position.employees.map((emp) => ({
            id: emp.id,
            email_hash: emp.email_hash,
            has_email: !!emp.email_encrypted,
            invited: emp.invitations.length > 0,
            invitation_status: emp.invitations[0]?.status ?? null,
            invited_at: emp.invitations[0]?.sent_at ?? null,
          })),
        })),
      })),
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('List employees error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
