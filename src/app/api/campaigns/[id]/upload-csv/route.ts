import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { hashEmail, generateToken } from '@/lib/crypto';
import { sendInvitationEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        company_id: true,
        status: true,
        campaign_salt: true,
        name: true,
        company: { select: { name: true } },
      },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    if (user.role === 'RH' && campaign.company_id !== user.company_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (campaign.status !== 'active') return NextResponse.json({ error: 'CSV import is only allowed when the campaign is active.' }, { status: 409 });

    const body = JSON.parse(await request.text());
    const rows: { unidade: string; setor: string; cargo: string; email: string }[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha válida encontrada' }, { status: 400 });
    }

    const validRows = rows.filter(
      (r) => r.unidade?.trim() && r.setor?.trim() && r.cargo?.trim() && r.email?.trim()?.includes('@')
    );

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha com dados válidos' }, { status: 400 });
    }

    const unitCache = new Map<string, string>();
    const sectorCache = new Map<string, string>();
    const positionCache = new Map<string, string>();
    let employeesCreated = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    for (const row of validRows) {
      // Upsert unit
      const unitKey = row.unidade.trim();
      let unitId = unitCache.get(unitKey);
      if (!unitId) {
        const existing = await prisma.campaignUnit.findFirst({
          where: { campaign_id: id, name: unitKey },
          select: { id: true },
        });
        unitId = existing
          ? existing.id
          : (await prisma.campaignUnit.create({ data: { campaign_id: id, name: unitKey }, select: { id: true } })).id;
        unitCache.set(unitKey, unitId);
      }

      // Upsert sector
      const sectorKey = `${unitId}:${row.setor.trim()}`;
      let sectorId = sectorCache.get(sectorKey);
      if (!sectorId) {
        const existing = await prisma.campaignSector.findFirst({
          where: { unit_id: unitId, name: row.setor.trim() },
          select: { id: true },
        });
        sectorId = existing
          ? existing.id
          : (await prisma.campaignSector.create({ data: { unit_id: unitId, name: row.setor.trim() }, select: { id: true } })).id;
        sectorCache.set(sectorKey, sectorId);
      }

      // Upsert position
      const positionKey = `${sectorId}:${row.cargo.trim()}`;
      let positionId = positionCache.get(positionKey);
      if (!positionId) {
        const existing = await prisma.campaignPosition.findFirst({
          where: { sector_id: sectorId, name: row.cargo.trim() },
          select: { id: true },
        });
        positionId = existing
          ? existing.id
          : (await prisma.campaignPosition.create({ data: { sector_id: sectorId, name: row.cargo.trim() }, select: { id: true } })).id;
        positionCache.set(positionKey, positionId);
      }

      // Upsert employee — only hash is stored, real email never written to DB
      const email = row.email.trim().toLowerCase();
      const emailHash = hashEmail(email, campaign.campaign_salt);
      const existingEmployee = await prisma.campaignEmployee.findUnique({
        where: { position_id_email_hash: { position_id: positionId, email_hash: emailHash } },
        select: { id: true },
      });

      if (!existingEmployee) {
        const newEmployee = await prisma.campaignEmployee.create({
          data: { position_id: positionId, email_hash: emailHash },
          select: { id: true },
        });
        employeesCreated++;

        const token = generateToken();

        await prisma.surveyInvitation.create({
          data: {
            campaign_id: id,
            employee_id: newEmployee.id,
            token_public: token,
            token_used: false,
            token_used_internally: false,
            status: 'sent',
            sent_at: now,
            expires_at: expiresAt,
          },
        });

        let emailSent = false;
        try {
          emailSent = await sendInvitationEmail({
            to: email,
            campaignName: campaign.name,
            companyName: campaign.company.name,
            token,
            expiresAt,
          });
        } catch (emailErr) {
          console.error(`[Upload] Email failed for token ${token}:`, emailErr);
        }

        if (emailSent) emailsSent++;
        else emailsFailed++;
      }
    }

    return NextResponse.json({
      units: unitCache.size,
      sectors: sectorCache.size,
      positions: positionCache.size,
      employees: employeesCreated,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
      total_rows: validRows.length,
    });
  } catch (err) {
    console.error('Upload CSV error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
