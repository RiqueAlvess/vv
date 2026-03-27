'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { hashEmail, generateSalt, generateToken } from '@/lib/crypto';
import { campaignSchema } from '@/lib/validations';

// ─── Shared result type ────────────────────────────────────────────────────

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function err(error: string): Err { return { success: false, error }; }

// ─── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Parses a CSV text with required columns: unidade, setor, cargo, email.
 * Returns an error string on bad format, otherwise the parsed rows.
 */
function parseCSV(
  text: string
): { unidade: string; setor: string; cargo: string; email: string }[] | string {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return 'CSV vazio ou sem dados';

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const ui = header.indexOf('unidade');
  const si = header.indexOf('setor');
  const ci = header.indexOf('cargo');
  const ei = header.indexOf('email');

  if (ui === -1 || si === -1 || ci === -1 || ei === -1) {
    return 'CSV deve conter as colunas: unidade, setor, cargo, email';
  }

  const rows: { unidade: string; setor: string; cargo: string; email: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length < 4) continue;
    rows.push({ unidade: cols[ui], setor: cols[si], cargo: cols[ci], email: cols[ei] });
  }

  if (rows.length === 0) return 'CSV não contém linhas válidas';
  return rows;
}

// ─── Campaign CRUD ─────────────────────────────────────────────────────────

export async function createCampaign(input: {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  company_id: string;
}): Promise<Result<{ id: string; status: string; name: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM' && session.role !== 'RH') return err('Sem permissão');

  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

  const { name, description, start_date, end_date, company_id } = parsed.data;

  // RH is locked to their own company
  if (session.role === 'RH' && company_id !== session.company_id) {
    return err('RH só pode criar campanhas para sua própria empresa');
  }

  const campaign = await prisma.campaign.create({
    data: {
      company_id,
      name,
      description: description ?? null,
      start_date,
      end_date,
      status: 'draft',
      campaign_salt: generateSalt(),
      created_by: session.user_id,
    },
    select: { id: true, status: true, name: true },
  });

  return ok(campaign);
}

export async function listCampaigns(
  page = 1,
  limit = 20
): Promise<Result<{ campaigns: unknown[]; total: number; totalPages: number }>> {
  const session = await requireSession();

  const where = session.role !== 'ADM' ? { company_id: session.company_id } : {};
  const offset = (Math.max(1, page) - 1) * Math.min(100, limit);

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: Math.min(100, limit),
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        start_date: true,
        end_date: true,
        company_id: true,
        created_at: true,
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return ok({ campaigns, total, totalPages: Math.ceil(total / limit) });
}

export async function getCampaign(id: string): Promise<Result<unknown>> {
  const session = await requireSession();

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      units: { include: { sectors: { include: { positions: true } } } },
      _count: { select: { invitations: true, responses: true } },
    },
  });

  if (!campaign) return err('Campanha não encontrada');
  if (session.role !== 'ADM' && campaign.company_id !== session.company_id) return err('Sem permissão');

  return ok(campaign);
}

export async function updateCampaign(
  id: string,
  input: { name?: string; description?: string; start_date?: string; end_date?: string }
): Promise<Result<{ id: string; status: string; name: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM' && session.role !== 'RH') return err('Sem permissão');

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, company_id: true, status: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (session.role === 'RH' && campaign.company_id !== session.company_id) return err('Sem permissão');
  if (campaign.status !== 'draft') return err('Apenas campanhas em rascunho podem ser editadas');

  const updated = await prisma.campaign.update({
    where: { id },
    data: { ...input },
    select: { id: true, status: true, name: true },
  });

  return ok(updated);
}

// ─── State transitions ─────────────────────────────────────────────────────

/** draft → active. Requires at least one sent invitation. */
export async function activateCampaign(id: string): Promise<Result<{ id: string; status: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM' && session.role !== 'RH') return err('Sem permissão');

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, company_id: true, status: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (session.role === 'RH' && campaign.company_id !== session.company_id) return err('Sem permissão');
  if (campaign.status !== 'draft') return err('Apenas campanhas em rascunho podem ser ativadas');

  const sentCount = await prisma.surveyInvitation.count({
    where: { campaign_id: id, status: 'sent' },
  });
  if (sentCount === 0) return err('É necessário ter pelo menos 1 convite enviado para ativar a campanha');

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: 'active' },
    select: { id: true, status: true },
  });

  return ok(updated);
}

/** active → closed. Triggers metrics computation. */
export async function closeCampaign(id: string): Promise<Result<{ id: string; status: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM' && session.role !== 'RH') return err('Sem permissão');

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, company_id: true, status: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (session.role === 'RH' && campaign.company_id !== session.company_id) return err('Sem permissão');
  if (campaign.status !== 'active') return err('Apenas campanhas ativas podem ser encerradas');

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: 'closed' },
    select: { id: true, status: true },
  });

  return ok(updated);
}

// ─── CSV upload ────────────────────────────────────────────────────────────

/**
 * Parses the uploaded CSV and upserts the Unit → Sector → Position → Employee
 * hierarchy for the campaign. Idempotent — safe to call multiple times.
 */
export async function uploadCampaignCSV(
  campaignId: string,
  formData: FormData
): Promise<Result<{ units: number; sectors: number; positions: number; employees: number }>> {
  const session = await requireSession();
  if (session.role !== 'ADM' && session.role !== 'RH') return err('Sem permissão');

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, company_id: true, status: true, campaign_salt: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (session.role === 'RH' && campaign.company_id !== session.company_id) return err('Sem permissão');
  if (campaign.status !== 'draft') return err('Upload só é permitido para campanhas em rascunho');

  const file = formData.get('file') as File | null;
  if (!file) return err('Arquivo CSV é obrigatório');

  const text = await file.text();
  const result = parseCSV(text);
  if (typeof result === 'string') return err(result);
  const rows = result;

  const unitCache = new Map<string, string>();
  const sectorCache = new Map<string, string>();
  const positionCache = new Map<string, string>();
  let employeesCreated = 0;

  for (const row of rows) {
    // Upsert unit
    let unitId = unitCache.get(row.unidade);
    if (!unitId) {
      const existing = await prisma.campaignUnit.findFirst({
        where: { campaign_id: campaignId, name: row.unidade },
        select: { id: true },
      });
      unitId = existing
        ? existing.id
        : (await prisma.campaignUnit.create({ data: { campaign_id: campaignId, name: row.unidade }, select: { id: true } })).id;
      unitCache.set(row.unidade, unitId);
    }

    // Upsert sector
    const sectorKey = `${unitId}:${row.setor}`;
    let sectorId = sectorCache.get(sectorKey);
    if (!sectorId) {
      const existing = await prisma.campaignSector.findFirst({
        where: { unit_id: unitId, name: row.setor },
        select: { id: true },
      });
      sectorId = existing
        ? existing.id
        : (await prisma.campaignSector.create({ data: { unit_id: unitId, name: row.setor }, select: { id: true } })).id;
      sectorCache.set(sectorKey, sectorId);
    }

    // Upsert position
    const positionKey = `${sectorId}:${row.cargo}`;
    let positionId = positionCache.get(positionKey);
    if (!positionId) {
      const existing = await prisma.campaignPosition.findFirst({
        where: { sector_id: sectorId, name: row.cargo },
        select: { id: true },
      });
      positionId = existing
        ? existing.id
        : (await prisma.campaignPosition.create({ data: { sector_id: sectorId, name: row.cargo }, select: { id: true } })).id;
      positionCache.set(positionKey, positionId);
    }

    // Upsert employee (email hashed with campaign-specific salt — no PII stored)
    const emailHash = hashEmail(row.email, campaign.campaign_salt);
    const existingEmployee = await prisma.campaignEmployee.findUnique({
      where: { position_id_email_hash: { position_id: positionId, email_hash: emailHash } },
      select: { id: true },
    });
    if (!existingEmployee) {
      await prisma.campaignEmployee.create({ data: { position_id: positionId, email_hash: emailHash } });
      employeesCreated++;
    }
  }

  return ok({
    units: unitCache.size,
    sectors: sectorCache.size,
    positions: positionCache.size,
    employees: employeesCreated,
  });
}

// ─── Invitations ───────────────────────────────────────────────────────────

/**
 * Creates SurveyInvitation records for the given employee IDs.
 * One invitation per employee. Duplicate calls are safely skipped.
 */
export async function sendInvitations(
  campaignId: string,
  employeeIds: string[]
): Promise<Result<{ created: number; total_requested: number }>> {
  const session = await requireSession();
  if (session.role !== 'ADM' && session.role !== 'RH') return err('Sem permissão');
  if (!employeeIds.length) return err('employee_ids não pode ser vazio');

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, company_id: true, status: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (session.role === 'RH' && campaign.company_id !== session.company_id) return err('Sem permissão');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  let created = 0;

  for (const employeeId of employeeIds) {
    try {
      await prisma.surveyInvitation.create({
        data: {
          campaign_id: campaignId,
          employee_id: employeeId,
          token_public: generateToken(),
          token_used: false,
          status: 'sent',
          sent_at: now,
          expires_at: expiresAt,
        },
      });
      created++;
    } catch {
      // Likely a duplicate — skip silently
    }
  }

  return ok({ created, total_requested: employeeIds.length });
}

export async function listInvitations(
  campaignId: string
): Promise<Result<unknown[]>> {
  const session = await requireSession();

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { company_id: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (session.role !== 'ADM' && campaign.company_id !== session.company_id) return err('Sem permissão');

  const invitations = await prisma.surveyInvitation.findMany({
    where: { campaign_id: campaignId },
    select: {
      id: true,
      status: true,
      token_used: true,
      sent_at: true,
      expires_at: true,
      employee: {
        select: {
          email_hash: true,
          position: { select: { name: true, sector: { select: { name: true, unit: { select: { name: true } } } } } },
        },
      },
    },
    orderBy: { sent_at: 'desc' },
  });

  return ok(invitations);
}
