import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type InputJsonValue = Prisma.InputJsonValue;

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

export interface LogPayload {
  action: string;
  message: string;
  user_id?: string;
  company_id?: string;
  target_id?: string;
  target_type?: string;
  metadata?: InputJsonValue;
  ip?: string;
}

/**
 * Fire-and-forget structured logger. Writes to core.system_logs.
 * Never throws — failures are swallowed so callers are never affected.
 */
export function log(level: LogLevel, payload: LogPayload): void {
  prisma.systemLog
    .create({ data: { level, ...payload } })
    .catch(console.error);
}
