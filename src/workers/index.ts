/**
 * Asta Background Workers
 *
 * Run with: npm run worker   (npx tsx src/workers/index.ts)
 *
 * This is a long-running Node.js process — NOT part of the Next.js app.
 * It connects to the same Redis and Postgres as the Next.js server.
 *
 * Current queues:
 *   status-updates — delayed invitation status flip (Blind Drop step 5)
 */

import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Redis connection ──────────────────────────────────────────────────────

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    // Required by BullMQ — disables the per-command timeout that breaks blocking calls
    maxRetriesPerRequest: null as null,
  };
}

const connection = parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379');

// ─── Status update worker ──────────────────────────────────────────────────

/**
 * Processes delayed status-update jobs enqueued by submitSurveyResponse().
 *
 * The delay (1–12 random hours) is the core of the temporal de-correlation
 * mechanism: even if an observer can see both the survey submission timestamp
 * and the invitation status change timestamp, the random gap makes correlation
 * statistically impossible without breaking the hash function.
 *
 * Idempotency: the WHERE clause only matches invitations that are NOT already
 * 'completed', so re-running a job (after a crash or retry) is safe.
 */
const statusWorker = new Worker<{ invitationId: string }>(
  'status-updates',
  async (job) => {
    const { invitationId } = job.data;

    if (!invitationId || typeof invitationId !== 'string') {
      // Malformed job — log and discard without retrying
      console.error(`[Worker] Malformed job ${job.id}: missing invitationId`);
      return;
    }

    // Idempotent update: only flip status if not already done.
    // updateMany returns a count so we don't throw on "not found" (already processed).
    const { count } = await prisma.surveyInvitation.updateMany({
      where: {
        id: invitationId,
        status: { not: 'completed' }, // guard against double-processing
      },
      data: {
        status: 'completed',
        token_used: true,
      },
    });

    if (count === 0) {
      console.log(`[Worker] Job ${job.id}: invitation ${invitationId} already completed — skipped`);
    } else {
      console.log(`[Worker] Job ${job.id}: invitation ${invitationId} marked completed`);
    }
  },
  {
    connection,
    concurrency: 5,
    // Remove completed jobs automatically to keep Redis lean
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  }
);

statusWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

console.log('[Worker] Status update worker started — waiting for jobs…');

// ─── Graceful shutdown ─────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`[Worker] ${signal} received — shutting down gracefully`);
  await statusWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
