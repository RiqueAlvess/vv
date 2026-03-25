import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

const connection = parseRedisUrl(redisUrl);

// Status Update Worker
// Processes delayed invitation status updates to prevent temporal correlation
const statusWorker = new Worker(
  'status-updates',
  async (job) => {
    const { invitationId } = job.data;

    try {
      await prisma.surveyInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'completed',
          token_used: true,
        },
      });
      console.log(`[Worker] Status updated for invitation ${invitationId}`);
    } catch (error) {
      console.error(`[Worker] Failed to update status for ${invitationId}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

statusWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

statusWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

console.log('[Worker] Status update worker started');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down...');
  await statusWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});
