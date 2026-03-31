import { GET } from '@/app/api/health/worker/route';

// Mock the BullMQ queue module
jest.mock('@/lib/queue', () => ({
  statusUpdateQueue: {
    getWorkers: jest.fn(),
  },
}));

import { statusUpdateQueue } from '@/lib/queue';

const mockGetWorkers = statusUpdateQueue.getWorkers as jest.Mock;

describe('GET /api/health/worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with status ok when workers are running', async () => {
    mockGetWorkers.mockResolvedValue([{ id: 'worker-1' }, { id: 'worker-2' }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', workers: 2 });
  });

  it('returns 503 with status degraded when no workers are running', async () => {
    mockGetWorkers.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'degraded', workers: 0 });
  });

  it('returns 503 when queue connectivity fails', async () => {
    mockGetWorkers.mockRejectedValue(new Error('Redis connection refused'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'degraded', workers: 0 });
  });
});
