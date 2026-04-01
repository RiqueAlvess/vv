import { AnonymityService } from '@/services/anonymity.service';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    surveyInvitation: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Mock the queue
jest.mock('@/lib/queues/status-update.queue', () => ({
  statusUpdateQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

// Mock crypto helpers (needed so the module resolves cleanly)
jest.mock('@/lib/crypto', () => ({
  hashEmail: jest.fn(),
  generateToken: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { statusUpdateQueue } from '@/lib/queues/status-update.queue';

const mockUpdate = prisma.surveyInvitation.update as jest.Mock;
const mockQueueAdd = statusUpdateQueue.add as jest.Mock;

describe('AnonymityService.scheduleStatusUpdate', () => {
  const invitationId = 'inv-abc-123';
  const delayMs = 3_600_000; // 1 hour

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues a job with the correct name and delay', async () => {
    await AnonymityService.scheduleStatusUpdate(invitationId, delayMs);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);

    const [jobName, , jobOptions] = mockQueueAdd.mock.calls[0];
    expect(jobName).toBe('process-status-update');
    // delay should be within 50 ms of the requested delayMs
    expect(jobOptions.delay).toBeGreaterThanOrEqual(delayMs - 50);
    expect(jobOptions.delay).toBeLessThanOrEqual(delayMs);
    expect(jobOptions.attempts).toBe(3);
    expect(jobOptions.backoff).toEqual({ type: 'exponential', delay: 2000 });
  });

  it('passes invitationId and scheduledAt in the job data', async () => {
    const before = Date.now();
    await AnonymityService.scheduleStatusUpdate(invitationId, delayMs);
    const after = Date.now();

    const [, jobData] = mockQueueAdd.mock.calls[0];
    expect(jobData.invitationId).toBe(invitationId);
    expect(jobData.scheduledAt).toBeInstanceOf(Date);
    expect(jobData.scheduledAt.getTime()).toBeGreaterThanOrEqual(before + delayMs);
    expect(jobData.scheduledAt.getTime()).toBeLessThanOrEqual(after + delayMs);
  });

  it('writes the scheduledAt timestamp to the database', async () => {
    await AnonymityService.scheduleStatusUpdate(invitationId, delayMs);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const { where, data } = mockUpdate.mock.calls[0][0];
    expect(where).toEqual({ id: invitationId });
    expect(data.status_update_scheduled_at).toBeInstanceOf(Date);
  });

  it('propagates errors thrown by queue.add', async () => {
    mockQueueAdd.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(
      AnonymityService.scheduleStatusUpdate(invitationId, delayMs)
    ).rejects.toThrow('Redis unavailable');
  });
});
