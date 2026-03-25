import { createHash, randomBytes, randomUUID } from 'crypto';

export function hashEmail(email: string, salt: string): string {
  return createHash('sha256')
    .update(`${salt}:${email.toLowerCase().trim()}`)
    .digest('hex');
}

export function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

export function generateToken(): string {
  return randomUUID();
}
