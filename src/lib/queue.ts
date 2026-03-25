import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL into connection options for BullMQ
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

export const statusUpdateQueue = new Queue('status-updates', {
  connection: parseRedisUrl(redisUrl),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
