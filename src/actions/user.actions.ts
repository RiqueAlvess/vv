'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { userSchema } from '@/lib/validations';

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function err(error: string): Err { return { success: false, error }; }

// ─── User CRUD ─────────────────────────────────────────────────────────────

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: 'ADM' | 'RH' | 'LIDERANCA';
  company_id: string;
}): Promise<Result<{ id: string; email: string; role: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM') return err('Apenas ADM pode criar usuários');

  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

  const { name, email, password, role, company_id } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return err('Email já cadastrado');

  const password_hash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email, password_hash, role, company_id },
    select: { id: true, email: true, role: true },
  });

  return ok(user);
}

export async function listUsers(): Promise<Result<unknown[]>> {
  const session = await requireSession();

  const where = session.role !== 'ADM' ? { company_id: session.company_id } : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      company_id: true,
      created_at: true,
    },
  });

  return ok(users);
}

export async function getUser(id: string): Promise<Result<unknown>> {
  const session = await requireSession();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true, company_id: true, created_at: true },
  });
  if (!user) return err('Usuário não encontrado');
  if (session.role !== 'ADM' && user.company_id !== session.company_id) return err('Sem permissão');

  return ok(user);
}

export async function updateUser(
  id: string,
  input: { name?: string; role?: 'ADM' | 'RH' | 'LIDERANCA'; active?: boolean }
): Promise<Result<{ id: string; name: string; role: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM') return err('Apenas ADM pode editar usuários');

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return err('Usuário não encontrado');

  const updated = await prisma.user.update({
    where: { id },
    data: { ...input },
    select: { id: true, name: true, role: true },
  });

  return ok(updated);
}

export async function deactivateUser(id: string): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  if (session.role !== 'ADM') return err('Apenas ADM pode desativar usuários');
  // Prevent self-deactivation
  if (id === session.user_id) return err('Você não pode desativar sua própria conta');

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return err('Usuário não encontrado');

  await prisma.user.update({ where: { id }, data: { active: false } });

  return ok({ id });
}
