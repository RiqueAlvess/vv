import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type JobType =
  | 'calculate_campaign_metrics'
  | 'send_invitation_email'
  | 'generate_dashboard_xlsx'
  | 'generate_campaign_pgr_html';

export interface JobPayload {
  calculate_campaign_metrics: { campaign_id: string };
  send_invitation_email: {
    to: string;
    campaign_name: string;
    company_name: string;
    token: string;
    expires_at: string;
  };
  generate_dashboard_xlsx: { campaign_id: string; requester_user_id: string };
  generate_campaign_pgr_html: { campaign_id: string; requester_user_id: string };
}

export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayload[T],
  options: { run_after?: Date; max_attempts?: number } = {}
): Promise<string> {
  const job = await prisma.job.create({
    data: {
      type,
      payload: payload as object,
      status: 'pending',
      run_after: options.run_after ?? new Date(),
      max_attempts: options.max_attempts ?? 3,
    },
    select: { id: true },
  });
  return job.id;
}

export async function claimNextJob(): Promise<{
  id: string;
  type: string;
  payload: Record<string, unknown>;
} | null> {
  const result = await prisma.$queryRaw<{ id: string; type: string; payload: unknown }[]>`
    UPDATE core.jobs
    SET
      status = 'processing',
      started_at = now(),
      attempts = attempts + 1
    WHERE id = (
      SELECT id FROM core.jobs
      WHERE status IN ('pending', 'failed')
        AND attempts < max_attempts
        AND run_after <= now()
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload
  `;

  if (!result.length) return null;
  return {
    id: result[0].id,
    type: result[0].type,
    payload: result[0].payload as Record<string, unknown>,
  };
}

export async function completeJob(id: string, payload?: Record<string, unknown>): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: {
      status: 'done',
      completed_at: new Date(),
      ...(payload ? { payload: payload as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function failJob(id: string, error: string): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: {
      status: 'failed',
      error: error.slice(0, 2000),
    },
  });
}

export async function getJobById(id: string) {
  return prisma.job.findUnique({ where: { id } });
}
