/**
 * Tests for POST /api/jobs/process and GET /api/jobs/process
 *
 * Security invariants verified:
 *  - Returns 500 when CRON_SECRET is not configured (misconfiguration signal)
 *  - Returns 401 when the wrong secret is supplied
 *  - Returns 200 / processes job when the correct secret is supplied
 */

jest.mock('@/lib/jobs', () => ({
  claimNextJob: jest.fn(),
  completeJob: jest.fn(),
  failJob: jest.fn(),
}));

jest.mock('@/services/metrics.service', () => ({
  calculateAndStoreCampaignMetrics: jest.fn(),
}));

jest.mock('@/lib/email', () => ({
  sendInvitationEmail: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      groupBy: jest.fn(),
    },
  },
}));

import { POST, GET } from '@/app/api/jobs/process/route';
import { claimNextJob } from '@/lib/jobs';

const mockClaimNextJob = claimNextJob as jest.Mock;

const CORRECT_SECRET = 'super-secret-cron-value';

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/jobs/process', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('POST /api/jobs/process — authorization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 500 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/not configured/i);
    expect(mockClaimNextJob).not.toHaveBeenCalled();
  });

  it('returns 401 when the wrong secret is provided', async () => {
    process.env.CRON_SECRET = CORRECT_SECRET;

    const response = await POST(makeRequest('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatch(/unauthorized/i);
    expect(mockClaimNextJob).not.toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    process.env.CRON_SECRET = CORRECT_SECRET;

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mockClaimNextJob).not.toHaveBeenCalled();
  });

  it('returns 200 idle when correct secret is provided and no jobs are pending', async () => {
    process.env.CRON_SECRET = CORRECT_SECRET;
    mockClaimNextJob.mockResolvedValue(null);

    const response = await POST(makeRequest(`Bearer ${CORRECT_SECRET}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('idle');
  });
});

describe('GET /api/jobs/process — authorization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 500 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;

    const request = new Request('http://localhost/api/jobs/process', { method: 'GET' });
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it('returns 401 when the wrong secret is provided', async () => {
    process.env.CRON_SECRET = CORRECT_SECRET;

    const request = new Request('http://localhost/api/jobs/process', {
      method: 'GET',
      headers: { authorization: 'Bearer bad' },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
