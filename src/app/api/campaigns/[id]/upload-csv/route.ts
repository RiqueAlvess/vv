import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { hashEmail } from '@/lib/crypto';
import { encryptEmail } from '@/lib/encryption';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseCSV(text: string): { unidade: string; setor: string; cargo: string; email: string }[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const unidadeIdx = header.indexOf('unidade');
  const setorIdx = header.indexOf('setor');
  const cargoIdx = header.indexOf('cargo');
  const emailIdx = header.indexOf('email');

  if (unidadeIdx === -1 || setorIdx === -1 || cargoIdx === -1 || emailIdx === -1) {
    throw new Error('CSV deve conter as colunas: unidade, setor, cargo, email');
  }

  const rows: { unidade: string; setor: string; cargo: string; email: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map((c) => c.trim());
    if (cols.length < 4) continue;

    rows.push({
      unidade: cols[unidadeIdx],
      setor: cols[setorIdx],
      cargo: cols[cargoIdx],
      email: cols[emailIdx],
    });
  }

  return rows;
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
      select: { id: true, company_id: true, status: true, campaign_salt: true },
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

    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Upload de CSV só é permitido para campanhas em rascunho' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo CSV é obrigatório' },
        { status: 400 }
      );
    }

    const text = await file.text();
    let rows: { unidade: string; setor: string; cargo: string; email: string }[];

    try {
      rows = parseCSV(text);
    } catch (parseError) {
      return NextResponse.json(
        { error: (parseError as Error).message },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV não contém dados válidos' },
        { status: 400 }
      );
    }

    const unitCache = new Map<string, string>();
    const sectorCache = new Map<string, string>();
    const positionCache = new Map<string, string>();
    let employeesCreated = 0;

    for (const row of rows) {
      // Find or create unit
      const unitKey = row.unidade;
      let unitId = unitCache.get(unitKey);

      if (!unitId) {
        const existingUnit = await prisma.campaignUnit.findFirst({
          where: { campaign_id: id, name: row.unidade },
          select: { id: true },
        });

        if (existingUnit) {
          unitId = existingUnit.id;
        } else {
          const newUnit = await prisma.campaignUnit.create({
            data: { campaign_id: id, name: row.unidade },
            select: { id: true },
          });
          unitId = newUnit.id;
        }
        unitCache.set(unitKey, unitId);
      }

      // Find or create sector
      const sectorKey = `${unitId}:${row.setor}`;
      let sectorId = sectorCache.get(sectorKey);

      if (!sectorId) {
        const existingSector = await prisma.campaignSector.findFirst({
          where: { unit_id: unitId, name: row.setor },
          select: { id: true },
        });

        if (existingSector) {
          sectorId = existingSector.id;
        } else {
          const newSector = await prisma.campaignSector.create({
            data: { unit_id: unitId, name: row.setor },
            select: { id: true },
          });
          sectorId = newSector.id;
        }
        sectorCache.set(sectorKey, sectorId);
      }

      // Find or create position
      const positionKey = `${sectorId}:${row.cargo}`;
      let positionId = positionCache.get(positionKey);

      if (!positionId) {
        const existingPosition = await prisma.campaignPosition.findFirst({
          where: { sector_id: sectorId, name: row.cargo },
          select: { id: true },
        });

        if (existingPosition) {
          positionId = existingPosition.id;
        } else {
          const newPosition = await prisma.campaignPosition.create({
            data: { sector_id: sectorId, name: row.cargo },
            select: { id: true },
          });
          positionId = newPosition.id;
        }
        positionCache.set(positionKey, positionId);
      }

      // Hash email and create employee if not exists
      const emailHash = hashEmail(row.email, campaign.campaign_salt);

      const existingEmployee = await prisma.campaignEmployee.findUnique({
        where: {
          position_id_email_hash: {
            position_id: positionId,
            email_hash: emailHash,
          },
        },
        select: { id: true },
      });

      if (!existingEmployee) {
        await prisma.campaignEmployee.create({
          data: {
            position_id: positionId,
            email_hash: emailHash,
            email_encrypted: encryptEmail(row.email),
          },
        });
        employeesCreated++;
      }
    }

    return NextResponse.json({
      units: unitCache.size,
      sectors: sectorCache.size,
      positions: positionCache.size,
      employees: employeesCreated,
    });
  } catch (err) {
    console.error('Upload CSV error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
