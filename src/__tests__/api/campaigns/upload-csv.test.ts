import { POST } from '@/app/api/campaigns/[id]/upload-csv/route';

// ── Prisma mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    campaign: { findUnique: jest.fn() },
  },
}));

// ── Auth mock ──────────────────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
}));

// ── Crypto mock ────────────────────────────────────────────────────────────────
let tokenCounter = 0;
jest.mock('@/lib/crypto', () => ({
  hashEmail: jest.fn((email: string) => `hash:${email}`),
  generateToken: jest.fn(() => `token-${++tokenCounter}`),
}));

// ── Email mock ─────────────────────────────────────────────────────────────────
jest.mock('@/lib/email', () => ({
  sendInvitationEmail: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { sendInvitationEmail } from '@/lib/email';

const mockTransaction = prisma.$transaction as jest.Mock;
const mockFindCampaign = prisma.campaign.findUnique as jest.Mock;
const mockGetAuthUser = getAuthUser as jest.Mock;
const mockSendEmail = sendInvitationEmail as jest.Mock;

// ── Fixtures ───────────────────────────────────────────────────────────────────
const CAMPAIGN = {
  id: 'camp-1',
  company_id: 'co-1',
  status: 'draft',
  campaign_salt: 'salt-abc',
  name: 'Test Campaign',
  company: { name: 'Test Corp' },
};

const ADM_USER = { id: 'user-1', role: 'ADM', company_id: 'co-1' };

function makeRequest(rows: object[]) {
  return new Request('http://localhost/api/campaigns/camp-1/upload-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

function makeParams(id = 'camp-1') {
  return { params: Promise.resolve({ id }) };
}

/** Build N employee rows, all in the same unit/sector/position */
function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    unidade: 'Unit A',
    setor: 'Sector A',
    cargo: 'Role A',
    email: `user${i}@example.com`,
  }));
}

// ── Structure transaction mock factory ────────────────────────────────────────
// Returns a mock tx for the first $transaction (units/sectors/positions)
function makeStructureTx(unitId = 'u-1', sectorId = 's-1', positionId = 'p-1') {
  return {
    campaignUnit: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([]) // no existing units
        .mockResolvedValueOnce([{ id: unitId, name: 'Unit A' }]), // after createMany
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    campaignSector: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([]) // no existing sectors
        .mockResolvedValueOnce([{ id: sectorId, unit_id: unitId, name: 'Sector A' }]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    campaignPosition: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([]) // no existing positions
        .mockResolvedValueOnce([{ id: positionId, sector_id: sectorId, name: 'Role A' }]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

// ── Employee transaction mock factory ─────────────────────────────────────────
function makeEmployeeTx(count: number) {
  let empCounter = 0;
  return {
    campaignEmployee: {
      findMany: jest.fn().mockResolvedValue([]), // no existing employees
      create: jest.fn().mockImplementation(() =>
        Promise.resolve({ id: `emp-${++empCounter}` })
      ),
    },
    surveyInvitation: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('POST /api/campaigns/[id]/upload-csv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenCounter = 0;
    mockGetAuthUser.mockResolvedValue(ADM_USER);
    mockFindCampaign.mockResolvedValue(CAMPAIGN);
  });

  // ── Test 1: batch upserts ──────────────────────────────────────────────────
  describe('batch upserts', () => {
    it('calls createMany for structural data instead of N individual creates for 100 employees', async () => {
      const rows = makeRows(100);
      const structureTx = makeStructureTx();
      const employeeTx = makeEmployeeTx(100);

      mockTransaction
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(structureTx))
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(employeeTx));

      mockSendEmail.mockResolvedValue(true);

      const res = await POST(makeRequest(rows), makeParams());
      const body = await res.json();

      expect(res.status).toBe(200);

      // createMany called once per entity type (not 100 times)
      expect(structureTx.campaignUnit.createMany).toHaveBeenCalledTimes(1);
      expect(structureTx.campaignSector.createMany).toHaveBeenCalledTimes(1);
      expect(structureTx.campaignPosition.createMany).toHaveBeenCalledTimes(1);

      // createMany received the deduplicated data (1 unique unit/sector/position)
      expect(structureTx.campaignUnit.createMany).toHaveBeenCalledWith({
        data: [{ campaign_id: 'camp-1', name: 'Unit A' }],
        skipDuplicates: true,
      });

      // 100 employees processed
      expect(body.processed).toBe(100);
      expect(employeeTx.campaignEmployee.create).toHaveBeenCalledTimes(100);
    });

    it('skips already-existing structural records instead of creating duplicates', async () => {
      const rows = makeRows(10);

      // Pre-existing unit/sector/position in the DB
      const structureTx = {
        campaignUnit: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ id: 'u-1', name: 'Unit A' }]) // already exists
            .mockResolvedValueOnce([{ id: 'u-1', name: 'Unit A' }]),
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        campaignSector: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ id: 's-1', unit_id: 'u-1', name: 'Sector A' }])
            .mockResolvedValueOnce([{ id: 's-1', unit_id: 'u-1', name: 'Sector A' }]),
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        campaignPosition: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ id: 'p-1', sector_id: 's-1', name: 'Role A' }])
            .mockResolvedValueOnce([{ id: 'p-1', sector_id: 's-1', name: 'Role A' }]),
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      const employeeTx = makeEmployeeTx(10);

      mockTransaction
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(structureTx))
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(employeeTx));

      mockSendEmail.mockResolvedValue(true);

      const res = await POST(makeRequest(rows), makeParams());
      expect(res.status).toBe(200);

      // createMany NOT called for units/sectors/positions (all pre-existed)
      expect(structureTx.campaignUnit.createMany).not.toHaveBeenCalled();
      expect(structureTx.campaignSector.createMany).not.toHaveBeenCalled();
      expect(structureTx.campaignPosition.createMany).not.toHaveBeenCalled();
    });
  });

  // ── Test 2: parallel email batches of 25 ──────────────────────────────────
  describe('parallel email batching', () => {
    it('sends 50 emails in two parallel batches of 25 and reports correct counts', async () => {
      const rows = makeRows(50);
      const structureTx = makeStructureTx();
      const employeeTx = makeEmployeeTx(50);

      mockTransaction
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(structureTx))
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(employeeTx));

      // Track maximum concurrent calls to verify batching
      let concurrent = 0;
      let maxConcurrent = 0;
      mockSendEmail.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            // Use setImmediate to simulate async work and let all batch items start
            setImmediate(() => {
              concurrent--;
              resolve(true);
            });
          })
      );

      const res = await POST(makeRequest(rows), makeParams());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(50);
      expect(body.emailsSent).toBe(50);
      expect(body.emailsFailed).toBe(0);

      // Batches of 25: max concurrency should not exceed 25
      expect(maxConcurrent).toBeLessThanOrEqual(25);
      // And it should have actually run concurrently within a batch
      expect(maxConcurrent).toBeGreaterThan(1);
    });

    it('sends exactly 100 emails in 4 batches when given 100 employees', async () => {
      const rows = makeRows(100);
      const structureTx = makeStructureTx();
      const employeeTx = makeEmployeeTx(100);

      mockTransaction
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(structureTx))
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(employeeTx));

      mockSendEmail.mockResolvedValue(true);

      const res = await POST(makeRequest(rows), makeParams());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(100);
      expect(body.processed).toBe(100);
      expect(body.emailsSent).toBe(100);
      expect(body.emailsFailed).toBe(0);
    });
  });

  // ── Test 3: partial email failures ────────────────────────────────────────
  describe('partial email failures', () => {
    it('returns 200 with emailsFailed: 3 when 3 out of 10 emails fail', async () => {
      const rows = makeRows(10);
      const structureTx = makeStructureTx();
      const employeeTx = makeEmployeeTx(10);

      mockTransaction
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(structureTx))
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(employeeTx));

      let callCount = 0;
      mockSendEmail.mockImplementation(() => {
        callCount++;
        // Fail calls 2, 5, 8 (arbitrary)
        if (callCount === 2 || callCount === 5 || callCount === 8) {
          return Promise.reject(new Error('Resend API error'));
        }
        return Promise.resolve(true);
      });

      const res = await POST(makeRequest(rows), makeParams());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.emailsSent).toBe(7);
      expect(body.emailsFailed).toBe(3);
      expect(body.processed).toBe(10);
    });

    it('returns 200 with emailsFailed: 3 when sendInvitationEmail returns false for 3 calls', async () => {
      const rows = makeRows(10);
      const structureTx = makeStructureTx();
      const employeeTx = makeEmployeeTx(10);

      mockTransaction
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(structureTx))
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(employeeTx));

      let callCount = 0;
      mockSendEmail.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 || callCount === 4 || callCount === 9 ? false : true);
      });

      const res = await POST(makeRequest(rows), makeParams());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.emailsSent).toBe(7);
      expect(body.emailsFailed).toBe(3);
    });

    it('returns 200 with emailsFailed: 25 when an entire batch of 25 rejects', async () => {
      const rows = makeRows(25);
      const structureTx = makeStructureTx();
      const employeeTx = makeEmployeeTx(25);

      mockTransaction
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(structureTx))
        .mockImplementationOnce((cb: (tx: unknown) => Promise<unknown>) => cb(employeeTx));

      mockSendEmail.mockRejectedValue(new Error('network timeout'));

      const res = await POST(makeRequest(rows), makeParams());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.emailsSent).toBe(0);
      expect(body.emailsFailed).toBe(25);
      expect(body.processed).toBe(25);
    });
  });

  // ── Auth / validation guards ───────────────────────────────────────────────
  describe('auth and validation', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      const res = await POST(makeRequest(makeRows(1)), makeParams());
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-draft campaign', async () => {
      mockFindCampaign.mockResolvedValue({ ...CAMPAIGN, status: 'active' });
      const res = await POST(makeRequest(makeRows(1)), makeParams());
      expect(res.status).toBe(400);
    });

    it('returns 400 when rows array is empty', async () => {
      const res = await POST(makeRequest([]), makeParams());
      expect(res.status).toBe(400);
    });

    it('returns 400 when all rows fail validation', async () => {
      const res = await POST(makeRequest([{ unidade: '', setor: '', cargo: '', email: 'bad' }]), makeParams());
      expect(res.status).toBe(400);
    });
  });
});
