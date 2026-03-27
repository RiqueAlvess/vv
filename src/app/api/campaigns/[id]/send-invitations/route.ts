import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { generateToken } from '@/lib/crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, company_id: true, status: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { employee_ids } = body;

    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
      return NextResponse.json(
        { error: 'employee_ids deve ser um array não vazio' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let createdCount = 0;

    for (const employeeId of employee_ids) {
      const tokenPublic = generateToken();

      try {
        await prisma.surveyInvitation.create({
          data: {
            campaign_id: id,
            employee_id: employeeId,
            token_public: tokenPublic,
            token_used: false,
            status: 'sent',
            sent_at: now,
            expires_at: expiresAt,
          },
        });
        createdCount++;
      } catch (error) {
        console.error('Create invitation error:', error);
        continue;
      }
    }

    return NextResponse.json({
      created: createdCount,
      total_requested: employee_ids.length,
    });
  } catch (err) {
    console.error('Send invitations error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
