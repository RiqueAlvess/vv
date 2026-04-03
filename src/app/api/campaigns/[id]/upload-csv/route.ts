import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM' && user.role !== 'RH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, company_id: true, status: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    if (user.role === 'RH' && campaign.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (campaign.status === 'closed') {
      return NextResponse.json(
        { error: 'Não é possível importar colaboradores em uma campanha encerrada.' },
        { status: 409 }
      );
    }

    const body = JSON.parse(await request.text());
    const rows: { unidade: string; setor: string; cargo: string }[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha válida encontrada' }, { status: 400 });
    }

    const validRows = rows.filter(
      (r) => r.unidade?.trim() && r.setor?.trim() && r.cargo?.trim()
    );

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha com dados válidos' }, { status: 400 });
    }

    // ── Batch-upsert units, sectors, and positions in one transaction ──
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

    const uniquePositions = new Set(
      validRows.map((r) => {
        const unitId = unitMap.get(r.unidade.trim())!;
        const sectorId = sectorMap.get(`${unitId}:${r.setor.trim()}`)!;
        return positionMap.get(`${sectorId}:${r.cargo.trim()}`)!;
      })
    );

    return NextResponse.json({
      units: uniqueUnitNames.length,
      sectors: [...new Set(validRows.map((r) => r.setor.trim()))].length,
      positions: uniquePositions.size,
      rows: validRows.length,
    });
  } catch (err) {
    console.error('Upload CSV error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
