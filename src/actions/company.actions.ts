'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { companySchema } from '@/lib/validations';

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function err(error: string): Err { return { success: false, error }; }

// ─── Company CRUD ──────────────────────────────────────────────────────────

export async function createCompany(input: {
  name: string;
  cnpj: string;
  cnae?: string;
}): Promise<Result<{ id: string; name: string; cnpj: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM') return err('Apenas ADM pode criar empresas');

  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

  const { name, cnpj, cnae } = parsed.data;

  const existing = await prisma.company.findUnique({ where: { cnpj }, select: { id: true } });
  if (existing) return err('CNPJ já cadastrado');

  const company = await prisma.company.create({
    data: { name, cnpj, cnae: cnae ?? null },
    select: { id: true, name: true, cnpj: true },
  });

  return ok(company);
}

export async function listCompanies(): Promise<Result<unknown[]>> {
  const session = await requireSession();
  if (session.role !== 'ADM') return err('Sem permissão');

  const companies = await prisma.company.findMany({
    orderBy: { created_at: 'desc' },
    select: { id: true, name: true, cnpj: true, cnae: true, active: true, created_at: true },
  });

  return ok(companies);
}

export async function getCompany(id: string): Promise<Result<unknown>> {
  const session = await requireSession();

  // Non-ADM users may only fetch their own company
  if (session.role !== 'ADM' && id !== session.company_id) return err('Sem permissão');

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      cnpj: true,
      cnae: true,
      active: true,
      created_at: true,
      _count: { select: { users: true, campaigns: true } },
    },
  });
  if (!company) return err('Empresa não encontrada');

  return ok(company);
}

export async function updateCompany(
  id: string,
  input: { name?: string; cnae?: string; active?: boolean }
): Promise<Result<{ id: string; name: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM') return err('Apenas ADM pode editar empresas');

  const company = await prisma.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) return err('Empresa não encontrada');

  const updated = await prisma.company.update({
    where: { id },
    data: { ...input },
    select: { id: true, name: true },
  });

  return ok(updated);
}
