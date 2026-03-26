import { cookies } from 'next/headers';
import { verifyToken } from './auth';
import type { JWTPayload } from '@/types';

/**
 * Reads the JWT from the 'token' cookie and verifies it.
 * Returns null if missing or invalid — never throws.
 */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Like getSession() but throws a typed error if unauthenticated.
 * Use this inside Server Actions that require a logged-in user.
 */
export async function requireSession(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session) throw new Error('Não autenticado');
  return session;
}
