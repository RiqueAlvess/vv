/**
 * Tests for GET /api/adm/stats
 */

// ── Prisma mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    company: { count: jest.fn() },
    user: { count: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

// ── Auth / rate-limit mocks ────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  apiLimiter: jest.fn(() => ({ success: true })),
}));

import { GET } from '@/app/api/adm/stats/route';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCompanyCount = prisma.company.count as jest.Mock;
const mockUserCount = prisma.user.count as jest.Mock;
const mockQueryRaw = prisma.$queryRaw as jest.Mock;

const ADM_USER = { user_id: 'user-adm', role: 'ADM', company_id: 'co-1' };
const RH_USER = { user_id: 'user-rh', role: 'RH', company_id: 'co-1' };

function makeRequest() {
  return new Request('http://localhost/api/adm/stats');
}

/** Set up the standard happy-path mocks */
function setupHappyPath() {
  // company.count called 3 times: total, active, withUsers
  mockCompanyCount
    .mockResolvedValueOnce(10)  // total
    .mockResolvedValueOnce(4)   // active (with active campaign)
    .mockResolvedValueOnce(8);  // withUsers

  // user.count called 6 times: total, rh, lider, activeToday, last7, last30
  mockUserCount
    .mockResolvedValueOnce(50)  // total
    .mockResolvedValueOnce(20)  // rh
    .mockResolvedValueOnce(15)  // lider
    .mockResolvedValueOnce(3)   // activeToday
    .mockResolvedValueOnce(12)  // activeLast7Days
    .mockResolvedValueOnce(30); // activeLast30Days

  // $queryRaw returns some sample rows (not necessarily 30 — we fill gaps)
  mockQueryRaw.mockResolvedValueOnce([
    { date: new Date('2026-03-30T00:00:00Z'), role: 'RH', count: 5 },
    { date: new Date('2026-03-30T00:00:00Z'), role: 'LIDERANCA', count: 2 },
  ]);
}

describe('GET /api/adm/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── 1. Auth guard: 403 for non-ADM ──────────────────────────────────────────
  it('returns 403 for unauthenticated requests', async () => {
    mockGetAuthUser.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADM role (RH)', async () => {
    mockGetAuthUser.mockResolvedValueOnce(RH_USER);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 for non-ADM role (LIDERANCA)', async () => {
    mockGetAuthUser.mockResolvedValueOnce({ ...RH_USER, role: 'LIDERANCA' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  // ── 2. Correct user counts by role ──────────────────────────────────────────
  it('returns correct user counts by role', async () => {
    mockGetAuthUser.mockResolvedValueOnce(ADM_USER);
    setupHappyPath();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.users.total).toBe(50);
    expect(body.users.rh).toBe(20);
    expect(body.users.lider).toBe(15);
    expect(body.users.activeToday).toBe(3);
    expect(body.users.activeLast7Days).toBe(12);
    expect(body.users.activeLast30Days).toBe(30);
  });

  // ── 3. accessTimeSeries has exactly 30 entries ───────────────────────────────
  it('accessTimeSeries has exactly 30 entries', async () => {
    mockGetAuthUser.mockResolvedValueOnce(ADM_USER);
    setupHappyPath();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.accessTimeSeries).toHaveLength(30);
  });

  it('each accessTimeSeries entry has date, rh, lider, total fields', async () => {
    mockGetAuthUser.mockResolvedValueOnce(ADM_USER);
    setupHappyPath();

    const res = await GET(makeRequest());
    const body = await res.json();

    for (const entry of body.accessTimeSeries) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('rh');
      expect(entry).toHaveProperty('lider');
      expect(entry).toHaveProperty('total');
      expect(typeof entry.date).toBe('string');
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('accessTimeSeries zero-fills days with no logins', async () => {
    mockGetAuthUser.mockResolvedValueOnce(ADM_USER);
    // Return empty time series from DB
    mockCompanyCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockUserCount
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockQueryRaw.mockResolvedValueOnce([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.accessTimeSeries).toHaveLength(30);
    for (const entry of body.accessTimeSeries) {
      expect(entry.rh).toBe(0);
      expect(entry.lider).toBe(0);
      expect(entry.total).toBe(0);
    }
  });

  // ── 4. companies.active counts only companies with active campaigns ──────────
  it('companies.active only counts companies with active campaigns', async () => {
    mockGetAuthUser.mockResolvedValueOnce(ADM_USER);
    setupHappyPath();

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.companies.total).toBe(10);
    expect(body.companies.active).toBe(4);
    expect(body.companies.withUsers).toBe(8);

    // Verify the second company.count call used the 'active' campaigns filter
    expect(mockCompanyCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaigns: { some: { status: 'active' } } },
      })
    );
  });
});
