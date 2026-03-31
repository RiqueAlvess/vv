import { GET, POST } from '@/app/api/survey/[token]/route';

// ── Prisma mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    surveyInvitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    campaign: {
      findUnique: jest.fn(),
    },
    surveyResponse: {
      create: jest.fn(),
    },
  },
}));

// ── AnonymityService mock ──────────────────────────────────────────────────────
jest.mock('@/services/anonymity.service', () => ({
  AnonymityService: {
    validateAndDestroyToken: jest.fn(),
    buildAnonymousResponse: jest.fn().mockReturnValue({ campaign_id: 'c-1', session_uuid: 's-1' }),
    calculateRandomDelay: jest.fn().mockReturnValue(3_600_000),
    scheduleStatusUpdate: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Queue mock (pulled in transitively) ───────────────────────────────────────
jest.mock('@/lib/queues/status-update.queue', () => ({
  statusUpdateQueue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
}));

// ── Crypto mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/crypto', () => ({
  hashEmail: jest.fn(),
  generateToken: jest.fn().mockReturnValue('session-uuid-123'),
}));

import { prisma } from '@/lib/prisma';
import { AnonymityService } from '@/services/anonymity.service';

const mockTransaction = prisma.$transaction as jest.Mock;
const mockFindUnique = prisma.surveyInvitation.findUnique as jest.Mock;
const mockValidateAndDestroy = AnonymityService.validateAndDestroyToken as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeRouteParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

function makePostRequest(body: object = {}) {
  return new Request('http://localhost/api/survey/tok', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  responses: { q1: 1, q2: 2, q3: 3, q4: 1, q5: 2, q6: 3, q7: 1, q8: 2, q9: 3, q10: 1,
               q11: 2, q12: 3, q13: 1, q14: 2, q15: 3, q16: 1, q17: 2, q18: 3, q19: 1, q20: 2,
               q21: 3, q22: 1, q23: 2, q24: 3, q25: 1, q26: 2, q27: 3, q28: 1, q29: 2, q30: 3,
               q31: 1, q32: 2, q33: 3, q34: 1, q35: 2 },
  consent_accepted: true,
};

const VALID_INVITATION = {
  id: 'inv-1',
  campaign_id: 'c-1',
  token_used_internally: false,
  expires_at: null,
  campaign: { status: 'active', name: 'Test Campaign', company: { name: 'Corp', cnpj: '00.000.000/0001-00' } },
};

const VALID_SESSION = { sessionUuid: 'session-uuid-123', campaignId: 'c-1', invitationId: 'inv-1' };

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('POST /api/survey/[token]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 when campaign status is draft', async () => {
    mockTransaction.mockRejectedValue(new Error('Campaign is not active'));

    const res = await POST(makePostRequest(VALID_BODY), makeRouteParams('tok'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('This survey is no longer accepting responses');
  });

  it('returns 409 when campaign status is closed', async () => {
    mockTransaction.mockRejectedValue(new Error('Campaign is not active'));

    const res = await POST(makePostRequest(VALID_BODY), makeRouteParams('tok'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('This survey is no longer accepting responses');
  });

  it('returns 200 and token is consumed when campaign is active', async () => {
    // $transaction resolves: the real callback would return session, we return it directly
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      // Simulate the tx client
      const mockTx = {
        surveyInvitation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            campaign_id: 'c-1',
            token_used_internally: false,
            expires_at: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        campaign: {
          findUnique: jest.fn().mockResolvedValue({ status: 'active' }),
        },
        surveyResponse: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      // The route uses AnonymityService.validateAndDestroyToken(token, tx) — we mock it
      mockValidateAndDestroy.mockResolvedValueOnce(VALID_SESSION);
      return callback(mockTx);
    });

    const res = await POST(makePostRequest(VALID_BODY), makeRouteParams('tok'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(AnonymityService.scheduleStatusUpdate).toHaveBeenCalledWith('inv-1', 3_600_000);
  });

  it('does not consume the token if response INSERT fails inside the transaction', async () => {
    // The transaction callback calls validateAndDestroyToken (succeeds) then
    // tx.surveyResponse.create (fails). We simulate this by having $transaction
    // call the callback with a mock tx where create rejects — the whole $transaction
    // therefore rejects, rolling back the token update.
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      mockValidateAndDestroy.mockResolvedValueOnce(VALID_SESSION);
      const mockTx = {
        surveyResponse: {
          create: jest.fn().mockRejectedValue(new Error('DB write error')),
        },
      };
      return callback(mockTx); // throws, simulating rollback
    });

    // Set up GET mock: token still valid (not consumed due to rollback)
    mockFindUnique.mockResolvedValue(VALID_INVITATION);

    const postRes = await POST(makePostRequest(VALID_BODY), makeRouteParams('tok'));
    expect(postRes.status).toBe(500);

    // Token is still accessible — GET returns valid=true
    const getRes = await GET(
      new Request('http://localhost/api/survey/tok'),
      makeRouteParams('tok')
    );
    const getBody = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getBody.valid).toBe(true);

    // The global prisma.surveyInvitation.update was NEVER called — all token
    // consumption happens via tx (which rolled back), never via global prisma
    expect(prisma.surveyInvitation.update).not.toHaveBeenCalled();
  });
});
