/**
 * Tests for the optimized report route.
 *
 * Key invariants verified:
 *  1. Exactly 2 Prisma data queries are made regardless of hierarchy depth:
 *     campaignUnit.findMany (with nested includes) + surveyResponse.findMany.
 *  2. computeDimensions produces correct scores for known inputs.
 *  3. Positions with no employees (zero possible respondents) return dimensions: {}.
 */

// ── Prisma mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findUnique: jest.fn() },
    campaignUnit: { findMany: jest.fn() },
    // These must never be called by the optimized route:
    campaignSector: { findMany: jest.fn() },
    campaignPosition: { findMany: jest.fn() },
    campaignEmployee: { findMany: jest.fn() },
    surveyInvitation: { findMany: jest.fn() },
    surveyResponse: { findMany: jest.fn() },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { POST } from '@/app/api/campaigns/[id]/report/route';
import { computeDimensions } from '@/lib/report-helpers';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { NR_MATRIX } from '@/lib/constants';

const mockFindCampaign   = prisma.campaign.findUnique as jest.Mock;
const mockFindUnits      = prisma.campaignUnit.findMany as jest.Mock;
const mockFindSectors    = prisma.campaignSector.findMany as jest.Mock;
const mockFindPositions  = prisma.campaignPosition.findMany as jest.Mock;
const mockFindEmployees  = prisma.campaignEmployee.findMany as jest.Mock;
const mockFindInvitations = prisma.surveyInvitation.findMany as jest.Mock;
const mockFindResponses  = prisma.surveyResponse.findMany as jest.Mock;
const mockGetAuthUser    = getAuthUser as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLOSED_CAMPAIGN = { id: 'camp-1', company_id: 'co-1', status: 'closed' };
const ADM_USER        = { user_id: 'u-1', role: 'ADM', company_id: 'co-1' };

/** Builds a flat answer map with every question set to `value` (1–35). */
function uniformAnswers(value: number): Record<string, number> {
  const answers: Record<string, number> = {};
  for (let q = 1; q <= 35; q++) answers[`q${q}`] = value;
  return answers;
}

/**
 * Deep hierarchy: 2 units × 2 sectors × 2 positions, each with 1 employee.
 * Used to verify that depth does not cause extra DB calls.
 */
function makeDeepHierarchy() {
  return [
    {
      id: 'unit-1', name: 'Unit A',
      sectors: [
        {
          id: 'sector-1', name: 'Sector A1',
          positions: [
            { id: 'pos-1', name: 'Position A1a', employees: [{ id: 'emp-1' }] },
            { id: 'pos-2', name: 'Position A1b', employees: [{ id: 'emp-2' }] },
          ],
        },
        {
          id: 'sector-2', name: 'Sector A2',
          positions: [
            { id: 'pos-3', name: 'Position A2a', employees: [{ id: 'emp-3' }] },
          ],
        },
      ],
    },
    {
      id: 'unit-2', name: 'Unit B',
      sectors: [
        {
          id: 'sector-3', name: 'Sector B1',
          positions: [
            { id: 'pos-4', name: 'Position B1a', employees: [{ id: 'emp-4' }] },
            { id: 'pos-5', name: 'Position B1b', employees: [{ id: 'emp-5' }] },
          ],
        },
      ],
    },
  ];
}

function makeRequest(id = 'camp-1') {
  return new Request(`http://localhost/api/campaigns/${id}/report`);
}

function makeParams(id = 'camp-1') {
  return { params: Promise.resolve({ id }) };
}

// ── computeDimensions unit tests ──────────────────────────────────────────────

describe('computeDimensions', () => {
  it('returns empty object when given no responses', () => {
    const result = computeDimensions([]);
    expect(result).toEqual({});
  });

  it('computes correct scores for all-uniform answers (value = 2)', () => {
    // With every question answered 2:
    //   NEGATIVE dims (demandas, relacionamentos): avg=2.0 → 2.0 >= 1.1 → 'moderado'
    //   POSITIVE dims (controle, apoio_chefia, apoio_colegas, cargo,
    //                  comunicacao_mudancas): avg=2.0 → 2.0 <= 2.0 → 'importante'
    const result = computeDimensions([uniformAnswers(2)]);

    const moderadoNR   = NR_MATRIX.moderado.probability * NR_MATRIX.default_severity;   // 2×3=6
    const importanteNR = NR_MATRIX.importante.probability * NR_MATRIX.default_severity; // 3×3=9

    expect(result.demandas).toEqual({ score: 2, risk: 'moderado', nr: moderadoNR });
    expect(result.relacionamentos).toEqual({ score: 2, risk: 'moderado', nr: moderadoNR });
    expect(result.controle).toEqual({ score: 2, risk: 'importante', nr: importanteNR });
    expect(result.apoio_chefia).toEqual({ score: 2, risk: 'importante', nr: importanteNR });
    expect(result.apoio_colegas).toEqual({ score: 2, risk: 'importante', nr: importanteNR });
    expect(result.cargo).toEqual({ score: 2, risk: 'importante', nr: importanteNR });
    expect(result.comunicacao_mudancas).toEqual({ score: 2, risk: 'importante', nr: importanteNR });
  });

  it('classifies critico for all-maximum answers on a NEGATIVE dimension', () => {
    // demandas (negative, qs 3,6,9,12,16,18,20,22): all 4 → avg=4.0 → 4.0 >= 3.1 → critico
    const result = computeDimensions([uniformAnswers(4)]);
    const criticoNR = NR_MATRIX.critico.probability * NR_MATRIX.default_severity; // 4×3=12
    expect(result.demandas).toEqual({ score: 4, risk: 'critico', nr: criticoNR });
  });

  it('classifies critico for all-zero answers on a POSITIVE dimension', () => {
    // controle (positive, qs 2,10,15,19,25,30): all 0 → avg=0.0 → 0.0 <= 1.0 → critico
    const result = computeDimensions([uniformAnswers(0)]);
    const criticoNR = NR_MATRIX.critico.probability * NR_MATRIX.default_severity; // 4×3=12
    expect(result.controle).toEqual({ score: 0, risk: 'critico', nr: criticoNR });
  });

  it('averages scores correctly across multiple responses', () => {
    // Two responses: one all-0, one all-4 → avg per question = 2.0
    const result = computeDimensions([uniformAnswers(0), uniformAnswers(4)]);
    expect(result.demandas.score).toBe(2);
    expect(result.controle.score).toBe(2);
  });

  it('produces entries for all 7 HSE-IT dimensions', () => {
    const result = computeDimensions([uniformAnswers(2)]);
    const expectedKeys = [
      'demandas', 'controle', 'apoio_chefia', 'apoio_colegas',
      'relacionamentos', 'cargo', 'comunicacao_mudancas',
    ];
    expect(Object.keys(result)).toEqual(expect.arrayContaining(expectedKeys));
    expect(Object.keys(result)).toHaveLength(7);
  });
});

// ── POST handler integration tests ────────────────────────────────────────────

describe('POST /api/campaigns/[id]/report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(ADM_USER);
    mockFindCampaign.mockResolvedValue(CLOSED_CAMPAIGN);
    mockFindUnits.mockResolvedValue(makeDeepHierarchy());
    mockFindResponses.mockResolvedValue([
      { responses: uniformAnswers(2) },
      { responses: uniformAnswers(2) },
    ]);
  });

  // ── Query count invariant ────────────────────────────────────────────────────

  it('makes exactly 2 data queries regardless of hierarchy depth', async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    // The two optimized queries
    expect(mockFindUnits).toHaveBeenCalledTimes(1);
    expect(mockFindResponses).toHaveBeenCalledTimes(1);

    // These must never be called — they were the N+1 culprits
    expect(mockFindSectors).not.toHaveBeenCalled();
    expect(mockFindPositions).not.toHaveBeenCalled();
    expect(mockFindEmployees).not.toHaveBeenCalled();
    expect(mockFindInvitations).not.toHaveBeenCalled();
  });

  it('fetches the hierarchy with a single unit query and correct campaign_id filter', async () => {
    await POST(makeRequest(), makeParams());
    expect(mockFindUnits).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaign_id: 'camp-1' } })
    );
  });

  it('fetches responses with a single query and correct campaign_id filter', async () => {
    await POST(makeRequest(), makeParams());
    expect(mockFindResponses).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaign_id: 'camp-1' } })
    );
  });

  // ── Score accuracy ───────────────────────────────────────────────────────────

  it('returns dimension scores that match computeDimensions output for all positions', async () => {
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    const expected = computeDimensions([uniformAnswers(2), uniformAnswers(2)]);

    // All positions with employees should carry the campaign-wide scores
    for (const unit of body.units) {
      for (const sector of unit.sectors) {
        for (const position of sector.positions) {
          expect(position.dimensions).toEqual(expected);
        }
      }
    }
  });

  // ── Positions with no employees ──────────────────────────────────────────────

  it('returns empty dimensions for positions that have no employees', async () => {
    mockFindUnits.mockResolvedValue([
      {
        id: 'unit-1', name: 'Unit A',
        sectors: [
          {
            id: 'sector-1', name: 'Sector A1',
            positions: [
              { id: 'pos-empty', name: 'Empty Position', employees: [] },         // no employees
              { id: 'pos-full',  name: 'Full Position',  employees: [{ id: 'emp-1' }] },
            ],
          },
        ],
      },
    ]);

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    const positions = body.units[0].sectors[0].positions;
    // Position with no employees → dimensions must be {} (zero possible respondents)
    expect(positions[0].name).toBe('Empty Position');
    expect(positions[0].dimensions).toEqual({});

    // Position with employees → full campaign-wide dimensions
    expect(positions[1].name).toBe('Full Position');
    expect(Object.keys(positions[1].dimensions)).toHaveLength(7);
  });

  // ── JSON structure is unchanged ──────────────────────────────────────────────

  it('returns the expected report JSON shape', async () => {
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(body).toHaveProperty('units');
    expect(Array.isArray(body.units)).toBe(true);

    const unit = body.units[0];
    expect(unit).toHaveProperty('name');
    expect(unit).toHaveProperty('sectors');

    const sector = unit.sectors[0];
    expect(sector).toHaveProperty('name');
    expect(sector).toHaveProperty('positions');

    const position = sector.positions[0];
    expect(position).toHaveProperty('name');
    expect(position).toHaveProperty('dimensions');

    const dim = position.dimensions['demandas'];
    expect(dim).toHaveProperty('score');
    expect(dim).toHaveProperty('risk');
    expect(dim).toHaveProperty('nr');
  });

  // ── Auth / guard rails ───────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 403 for LIDERANCA role', async () => {
    mockGetAuthUser.mockResolvedValue({ ...ADM_USER, role: 'LIDERANCA' });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it('returns 403 for RH user from a different company', async () => {
    mockGetAuthUser.mockResolvedValue({ user_id: 'rh-1', role: 'RH', company_id: 'co-OTHER' });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it('returns 404 when campaign does not exist', async () => {
    mockFindCampaign.mockResolvedValue(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-closed campaign', async () => {
    mockFindCampaign.mockResolvedValue({ ...CLOSED_CAMPAIGN, status: 'active' });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
  });

  it('returns 404 when campaign has no units', async () => {
    mockFindUnits.mockResolvedValue([]);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 404 when campaign has no responses', async () => {
    mockFindResponses.mockResolvedValue([]);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });
});
