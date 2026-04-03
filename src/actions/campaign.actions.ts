'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { generateSalt } from '@/lib/crypto';
import { campaignSchema } from '@/lib/validations';

// ─── Shared result type ────────────────────────────────────────────────────

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function err(error: string): Err { return { success: false, error }; }

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
      _count: { select: { responses: true } },
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

/** draft → active */
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

// ─── QR Codes ─────────────────────────────────────────────────────────────

/** List QR codes for a campaign */
export async function listQRCodes(campaignId: string): Promise<Result<unknown[]>> {
  const session = await requireSession();

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { company_id: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (session.role !== 'ADM' && campaign.company_id !== session.company_id) return err('Sem permissão');

  const qrCodes = await prisma.campaignQRCode.findMany({
    where: { campaign_id: campaignId },
    orderBy: { created_at: 'desc' },
    select: { id: true, token: true, is_active: true, created_at: true, deactivated_at: true },
  });

  return ok(qrCodes);
}
