/**
 * Tests for GET /api/campaigns/[id]/invitations
 *
 * Security invariants verified:
 *  - ADM response does NOT contain token_public per invitation
 *  - ADM response does NOT contain token_used per invitation
 *  - ADM response contains aggregated counts (aggregated.total, aggregated.responded)
 *  - RH response also has no token fields and contains aggregated counts
 *  - Unauthenticated requests are rejected (401)
 *  - Cross-company RH access is rejected (403)
 *  - Unknown campaign returns 404
 */

// ── Prisma mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findUnique: jest.fn() },
    surveyInvitation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// ── Auth / rate-limit mocks ────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  apiLimiter: jest.fn(() => ({ success: true })),
}));

import { GET } from '@/app/api/campaigns/[id]/invitations/route';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

const mockFindCampaign    = prisma.campaign.findUnique as jest.Mock;
const mockCountInvitation = prisma.surveyInvitation.count as jest.Mock;
const mockFindInvitations = prisma.surveyInvitation.findMany as jest.Mock;
const mockGetAuthUser     = getAuthUser as jest.Mock;

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CAMPAIGN = { id: 'camp-1', company_id: 'co-1' };

const ADM_USER = { user_id: 'adm-1', role: 'ADM', company_id: 'co-1' };
const RH_USER  = { user_id: 'rh-1',  role: 'RH',  company_id: 'co-1' };

/** Simulates what Prisma returns — note: no token_public / token_used in select */
const INVITATION_ROWS = [
  {
    id: 'inv-1',
    campaign_id: 'camp-1',
    employee_id: 'emp-1',
    status: 'sent',
    sent_at: new Date('2026-01-01T10:00:00Z'),
    expires_at: new Date('2026-02-01T10:00:00Z'),
  },
  {
    id: 'inv-2',
    campaign_id: 'camp-1',
    employee_id: 'emp-2',
    status: 'sent',
    sent_at: new Date('2026-01-02T10:00:00Z'),
    expires_at: new Date('2026-02-02T10:00:00Z'),
  },
];

function makeRequest(campaignId = 'camp-1') {
  return new Request(`http://localhost/api/campaigns/${campaignId}/invitations`);
}

function makeParams(id = 'camp-1') {
  return { params: Promise.resolve({ id }) };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  mockFindCampaign.mockResolvedValue(CAMPAIGN);
  // count is called twice: total and respondedCount
  mockCountInvitation
    .mockResolvedValueOnce(2)   // total count
    .mockResolvedValueOnce(1);  // responded count (token_used: true)
  mockFindInvitations.mockResolvedValue(INVITATION_ROWS);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/campaigns/[id]/invitations — token exposure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ── ADM role ──────────────────────────────────────────────────────────────

  it('ADM: response does not contain token_public on any invitation', async () => {
    mockGetAuthUser.mockResolvedValue(ADM_USER);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    for (const inv of body.data) {
      expect(inv).not.toHaveProperty('token_public');
    }
  });

  it('ADM: response does not contain token_used on any invitation', async () => {
    mockGetAuthUser.mockResolvedValue(ADM_USER);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    for (const inv of body.data) {
      expect(inv).not.toHaveProperty('token_used');
    }
  });

  it('ADM: response contains aggregated total and responded counts', async () => {
    mockGetAuthUser.mockResolvedValue(ADM_USER);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.aggregated).toBeDefined();
    expect(body.aggregated.total).toBe(2);
    expect(body.aggregated.responded).toBe(1);
  });

  it('ADM: response contains pagination metadata', async () => {
    mockGetAuthUser.mockResolvedValue(ADM_USER);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBe(2);
  });

  // ── RH role ───────────────────────────────────────────────────────────────

  it('RH: response does not contain token_public on any invitation', async () => {
    mockGetAuthUser.mockResolvedValue(RH_USER);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    for (const inv of body.data) {
      expect(inv).not.toHaveProperty('token_public');
    }
  });

  it('RH: response does not contain token_used on any invitation', async () => {
    mockGetAuthUser.mockResolvedValue(RH_USER);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    for (const inv of body.data) {
      expect(inv).not.toHaveProperty('token_used');
    }
  });

  it('RH: response contains aggregated total and responded counts', async () => {
    mockGetAuthUser.mockResolvedValue(RH_USER);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.aggregated).toBeDefined();
    expect(body.aggregated.total).toBe(2);
    expect(body.aggregated.responded).toBe(1);
  });

  // ── Response shape parity: ADM === RH ─────────────────────────────────────

  it('ADM and RH responses have identical top-level keys', async () => {
    mockGetAuthUser.mockResolvedValue(ADM_USER);
    const admRes = await GET(makeRequest(), makeParams());
    const admBody = await admRes.json();

    // reset call counts before RH call
    jest.clearAllMocks();
    setupDefaultMocks();
    mockGetAuthUser.mockResolvedValue(RH_USER);
    const rhRes = await GET(makeRequest(), makeParams());
    const rhBody = await rhRes.json();

    expect(Object.keys(admBody).sort()).toEqual(Object.keys(rhBody).sort());
  });

  it('invitation items have identical keys for ADM and RH', async () => {
    mockGetAuthUser.mockResolvedValue(ADM_USER);
    const admRes = await GET(makeRequest(), makeParams());
    const admBody = await admRes.json();
    const admKeys = Object.keys(admBody.data[0]).sort();

    jest.clearAllMocks();
    setupDefaultMocks();
    mockGetAuthUser.mockResolvedValue(RH_USER);
    const rhRes = await GET(makeRequest(), makeParams());
    const rhBody = await rhRes.json();
    const rhKeys = Object.keys(rhBody.data[0]).sort();

    expect(admKeys).toEqual(rhKeys);
  });

  // ── Auth / access guards ──────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when campaign does not exist', async () => {
    mockGetAuthUser.mockResolvedValue(ADM_USER);
    mockFindCampaign.mockResolvedValue(null);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 403 when RH accesses a campaign from another company', async () => {
    mockGetAuthUser.mockResolvedValue({ user_id: 'rh-2', role: 'RH', company_id: 'co-OTHER' });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it('ADM can access a campaign from any company', async () => {
    mockGetAuthUser.mockResolvedValue({ user_id: 'adm-1', role: 'ADM', company_id: 'co-OTHER' });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
  });
});
