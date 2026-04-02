import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { hashEmail, generateToken } from '@/lib/crypto';
import { sendInvitationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

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

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ── Phase 1: Batch-upsert units, sectors, and positions in one transaction ──
    const uniqueUnitNames = [...new Set(validRows.map((r) => r.unidade.trim()))];

    const { unitMap, sectorMap, positionMap } = await prisma.$transaction(async (tx) => {
      // Units
      const existingUnits = await tx.campaignUnit.findMany({
        where: { campaign_id: id, name: { in: uniqueUnitNames } },
        select: { id: true, name: true },
      });
      const existingUnitNames = new Set(existingUnits.map((u) => u.name));
      const newUnitNames = uniqueUnitNames.filter((n) => !existingUnitNames.has(n));
      if (newUnitNames.length > 0) {
        await tx.campaignUnit.createMany({
          data: newUnitNames.map((name) => ({ campaign_id: id, name })),
          skipDuplicates: true,
        });
      }
      const allUnits = await tx.campaignUnit.findMany({
        where: { campaign_id: id, name: { in: uniqueUnitNames } },
        select: { id: true, name: true },
      });
      const unitMap = new Map(allUnits.map((u) => [u.name, u.id]));

      // Sectors
      const uniqueSectorEntries = [
        ...new Map(
          validRows.map((r) => {
            const unitId = unitMap.get(r.unidade.trim())!;
            return [`${unitId}:${r.setor.trim()}`, { unit_id: unitId, name: r.setor.trim() }];
          })
        ).values(),
      ];
      const sectorUnitIds = [...new Set(uniqueSectorEntries.map((s) => s.unit_id))];
      const existingSectors = await tx.campaignSector.findMany({
        where: { unit_id: { in: sectorUnitIds } },
        select: { id: true, unit_id: true, name: true },
      });
      const existingSectorKeys = new Set(existingSectors.map((s) => `${s.unit_id}:${s.name}`));
      const newSectorEntries = uniqueSectorEntries.filter(
        (s) => !existingSectorKeys.has(`${s.unit_id}:${s.name}`)
      );
      if (newSectorEntries.length > 0) {
        await tx.campaignSector.createMany({ data: newSectorEntries, skipDuplicates: true });
      }
      const allSectors = await tx.campaignSector.findMany({
        where: { unit_id: { in: sectorUnitIds } },
        select: { id: true, unit_id: true, name: true },
      });
      const sectorMap = new Map(allSectors.map((s) => [`${s.unit_id}:${s.name}`, s.id]));

      // Positions
      const uniquePositionEntries = [
        ...new Map(
          validRows.map((r) => {
            const unitId = unitMap.get(r.unidade.trim())!;
            const sectorId = sectorMap.get(`${unitId}:${r.setor.trim()}`)!;
            return [`${sectorId}:${r.cargo.trim()}`, { sector_id: sectorId, name: r.cargo.trim() }];
          })
        ).values(),
      ];
      const positionSectorIds = [...new Set(uniquePositionEntries.map((p) => p.sector_id))];
      const existingPositions = await tx.campaignPosition.findMany({
        where: { sector_id: { in: positionSectorIds } },
        select: { id: true, sector_id: true, name: true },
      });
      const existingPositionKeys = new Set(existingPositions.map((p) => `${p.sector_id}:${p.name}`));
      const newPositionEntries = uniquePositionEntries.filter(
        (p) => !existingPositionKeys.has(`${p.sector_id}:${p.name}`)
      );
      if (newPositionEntries.length > 0) {
        await tx.campaignPosition.createMany({ data: newPositionEntries, skipDuplicates: true });
      }
      const allPositions = await tx.campaignPosition.findMany({
        where: { sector_id: { in: positionSectorIds } },
        select: { id: true, sector_id: true, name: true },
      });
      const positionMap = new Map(allPositions.map((p) => [`${p.sector_id}:${p.name}`, p.id]));

      return { unitMap, sectorMap, positionMap };
    });

    // ── Phase 2: Batch-upsert employees + create invitations in one transaction ─
    const employeeData = [
      ...new Map(
        validRows.map((r) => {
          const unitId = unitMap.get(r.unidade.trim())!;
          const sectorId = sectorMap.get(`${unitId}:${r.setor.trim()}`)!;
          const positionId = positionMap.get(`${sectorId}:${r.cargo.trim()}`)!;
          const email = r.email.trim().toLowerCase();
          const emailHash = hashEmail(email, campaign.campaign_salt);
          return [`${positionId}:${emailHash}`, { positionId, email, emailHash }];
        })
      ).values(),
    ];

    const invitationsToSend = await prisma.$transaction(async (tx) => {
      const existingEmployees =
        employeeData.length > 0
          ? await tx.campaignEmployee.findMany({
              where: {
                OR: employeeData.map((e) => ({
                  position_id: e.positionId,
                  email_hash: e.emailHash,
                })),
              },
              select: { position_id: true, email_hash: true },
            })
          : [];

      const existingSet = new Set(
        existingEmployees.map((e) => `${e.position_id}:${e.email_hash}`)
      );
      const newEmployees = employeeData.filter(
        (e) => !existingSet.has(`${e.positionId}:${e.emailHash}`)
      );

      return Promise.all(
        newEmployees.map(async (e) => {
          const emp = await tx.campaignEmployee.create({
            data: { position_id: e.positionId, email_hash: e.emailHash },
            select: { id: true },
          });
          const token = generateToken();
          await tx.surveyInvitation.create({
            data: {
              campaign_id: id,
              employee_id: emp.id,
              token_public: token,
              token_used: false,
              token_used_internally: false,
              status: 'sent',
              sent_at: now,
              expires_at: expiresAt,
            },
          });
          return { email: e.email, token };
        })
      );
    });

    // ── Phase 3: Send emails in parallel batches of 25 ────────────────────────
    let emailsSent = 0;
    let emailsFailed = 0;

    for (let i = 0; i < invitationsToSend.length; i += 25) {
      const batch = invitationsToSend.slice(i, i + 25);
      const results = await Promise.allSettled(
        batch.map((inv) =>
          sendInvitationEmail({
            to: inv.email,
            campaignName: campaign.name,
            companyName: campaign.company.name,
            token: inv.token,
            expiresAt,
          })
        )
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && result.value === true) {
          emailsSent++;
        } else {
          emailsFailed++;
          const reason =
            result.status === 'rejected' ? result.reason : 'sendInvitationEmail returned false';
          console.error('[EmailBatch]', reason, batch[j].email);
        }
      }
    }

    return NextResponse.json({
      processed: invitationsToSend.length,
      emailsSent,
      emailsFailed,
    });
  } catch (err) {
    console.error('Upload CSV error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
