import { createHash, randomBytes, randomUUID } from 'crypto';

export function hashEmail(email: string, salt: string): string {
  return createHash('sha256')
    .update(`${salt}:${email.toLowerCase().trim()}`)
    .digest('hex');
}

/** Hash a CPF for deterministic lookup. Normalises to digits-only first. */
export function hashCpf(cpf: string, salt: string): string {
  const digits = cpf.replace(/\D/g, '');
  return createHash('sha256')
    .update(`${salt}:cpf:${digits}`)
    .digest('hex');
}

/** Strip CPF to digits only. */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

export function generateToken(): string {
  return randomUUID();
}
