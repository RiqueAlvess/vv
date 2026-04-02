import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { generateToken } from '@/lib/crypto';
import { decryptEmail } from '@/lib/encryption';
import { sendSurveyInvitation } from '@/lib/email';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { company: { select: { name: true } } },
    });
    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }
    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (campaign.status !== 'active') {
      return NextResponse.json(
        { error: 'Invitations can only be sent when the campaign is active.' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { employee_ids, send_all } = body as {
      employee_ids?: string[];
      send_all?: boolean;
    };

    let employees: { id: string; email_encrypted: string | null }[];

    if (send_all) {
      employees = await prisma.campaignEmployee.findMany({
        where: {
          position: { sector: { unit: { campaign_id: campaignId } } },
          email_encrypted: { not: null },
          invitations: { none: {} },
        },
        select: { id: true, email_encrypted: true },
      });
    } else {
      if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return NextResponse.json(
          { error: 'employee_ids deve ser array não vazio' },
          { status: 400 }
        );
      }
      employees = await prisma.campaignEmployee.findMany({
        where: { id: { in: employee_ids }, email_encrypted: { not: null } },
        select: { id: true, email_encrypted: true },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const employee of employees) {
      try {
        const token = generateToken();

        await prisma.surveyInvitation.create({
          data: {
            campaign_id: campaignId,
            employee_id: employee.id,
            token_public: token,
            status: 'sent',
            sent_at: now,
            expires_at: expiresAt,
          },
        });

        const email = decryptEmail(employee.email_encrypted!);
        const result = await sendSurveyInvitation({
          to: email,
          campaignName: campaign.name,
          companyName: campaign.company.name,
          surveyUrl: `${baseUrl}/survey/${token}`,
          expiresAt,
        });

        if (result) {
          // Email served its purpose — delete the encrypted copy
          await prisma.campaignEmployee.update({
            where: { id: employee.id },
            data: { email_encrypted: null },
          });
          sent++;
        } else {
          failed++;
          errors.push(`Failed to send to employee ${employee.id}`);
        }
      } catch (err) {
        failed++;
        errors.push(
          `Employee ${employee.id}: ${err instanceof Error ? err.message : 'unknown error'}`
        );
      }
    }

    return NextResponse.json({
      sent,
      failed,
      total_requested: employees.length,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('Send invitations error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
