/**
 * Tests for the dashboard route cache layer.
 *
 * Strategy:
 *  - Mock prisma so we can control what campaignMetrics.findUnique / surveyResponse.findMany return
 *  - Mock getAuthUser so auth always passes
 *  - Test the exported getCampaignMetricsWithCache helper directly for unit coverage
 *  - Test the GET handler end-to-end for integration coverage
 */

// ── Prisma mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findUnique: jest.fn() },
    campaignMetrics: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    surveyResponse: { findMany: jest.fn() },
    surveyInvitation: { count: jest.fn() },
    campaignUnit: { findMany: jest.fn() },
    campaignSector: { findMany: jest.fn() },
    campaignPosition: { findMany: jest.fn() },
  },
}));

// ── Auth / rate-limit mocks ────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  apiLimiter: jest.fn(() => ({ success: true })),
}));

import { GET, getCampaignMetricsWithCache } from '@/app/api/campaigns/[id]/dashboard/route';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

const mockFindCampaign     = prisma.campaign.findUnique as jest.Mock;
const mockFindMetrics      = prisma.campaignMetrics.findUnique as jest.Mock;
const mockUpsertMetrics    = prisma.campaignMetrics.upsert as jest.Mock;
const mockFindResponses    = prisma.surveyResponse.findMany as jest.Mock;
const mockCountInvitations = prisma.surveyInvitation.count as jest.Mock;
const mockFindUnits        = prisma.campaignUnit.findMany as jest.Mock;
const mockFindSectors      = prisma.campaignSector.findMany as jest.Mock;
const mockFindPositions    = prisma.campaignPosition.findMany as jest.Mock;
const mockGetAuthUser      = getAuthUser as jest.Mock;

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CLOSED_CAMPAIGN = {
  id: 'camp-1',
  company_id: 'co-1',
  status: 'closed',
  name: 'Test Campaign',
};

const ACTIVE_CAMPAIGN = { ...CLOSED_CAMPAIGN, status: 'active' };

const ADM_USER = { user_id: 'user-1', role: 'ADM', company_id: 'co-1' };

/** A minimal but valid CampaignMetrics row with pre-computed data */
function makeCachedMetrics(updatedAt: Date = new Date()) {
  return {
    id: 'metrics-1',
    campaign_id: 'camp-1',
    total_invited: 50,
    total_responded: 40,
    response_rate: '80.00',
    igrp: '4.00',
    risk_distribution: {
      campaign_name: 'Test Campaign',
      igrp_label: 'Moderado',
      igrp_color: '#eab308',
      workers_high_risk_pct: 10,
      workers_critical_pct: 2,
      stacked_by_dimension: [{ dimension: 'Demandas', key: 'demandas' }],
      stacked_by_question: [],
    },
    dimension_scores: [{ key: 'demandas', avg_score: 2.5 }],
    demographic_data: {
      gender_distribution: { Masculino: 20, Feminino: 20 },
      age_distribution: { '25-34': 15 },
    },
    heatmap_data: [{ unit: 'HQ', dimensions: {} }],
    top_critical_sectors: {
      top_sectors_by_nr: [{ sector: 'Vendas', nr: 4 }],
      top_positions_by_nr: [],
    },
    scores_by_gender: [{ gender: 'Masculino', total_responses: 20 }],
    scores_by_age: [{ age_range: '25-34', total_responses: 15 }],
    top_critical_groups: [{ position: 'Dev', nr: 4 }],
    calculated_at: updatedAt,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

/** Minimal survey response with answers for all 35 HSE-IT questions */
function makeSurveyResponse(id: string) {
  const responses: Record<string, number> = {};
  for (let q = 1; q <= 35; q++) responses[`q${q}`] = 2;
  return { id, gender: 'M', age_range: '25-34', responses, created_at: new Date() };
}

function makeRequest(campaignId = 'camp-1', params = '') {
  return new Request(`http://localhost/api/campaigns/${campaignId}/dashboard${params}`);
}

function makeParams(id = 'camp-1') {
  return { params: Promise.resolve({ id }) };
}

// ── Helper: set up mocks for a successful live-computation path ────────────────
function setupLiveComputationMocks() {
  mockFindResponses.mockResolvedValue([makeSurveyResponse('r-1'), makeSurveyResponse('r-2')]);
  mockCountInvitations.mockResolvedValue(10);
  mockFindUnits.mockResolvedValue([]);
  mockFindSectors.mockResolvedValue([]);
  mockFindPositions.mockResolvedValue([]);
  mockUpsertMetrics.mockResolvedValue({});
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('getCampaignMetricsWithCache', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when no cached record exists', async () => {
    mockFindMetrics.mockResolvedValue(null);
    const result = await getCampaignMetricsWithCache('camp-1', 'closed');
    expect(result).toBeNull();
  });

  it('returns null when cached record has no risk_distribution (incomplete entry)', async () => {
    mockFindMetrics.mockResolvedValue({ ...makeCachedMetrics(), risk_distribution: null });
    const result = await getCampaignMetricsWithCache('camp-1', 'closed');
    expect(result).toBeNull();
  });

  it('returns cached data for a closed campaign regardless of age', async () => {
    const ancient = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days old
    mockFindMetrics.mockResolvedValue(makeCachedMetrics(ancient));

    const result = await getCampaignMetricsWithCache('camp-1', 'closed');

    expect(result).not.toBeNull();
    expect(result!.campaign_id).toBe('camp-1');
    expect(result!.igrp).toBe(4);
    expect(result!.total_invited).toBe(50);
    expect(result!.total_responded).toBe(40);
  });

  it('returns cached data for an active campaign when cache is < 5 min old', async () => {
    const fresh = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes old
    mockFindMetrics.mockResolvedValue(makeCachedMetrics(fresh));

    const result = await getCampaignMetricsWithCache('camp-1', 'active');

    expect(result).not.toBeNull();
    expect(result!.igrp).toBe(4);
  });

  it('returns null for an active campaign when cache is > 5 min old', async () => {
    const stale = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes old
    mockFindMetrics.mockResolvedValue(makeCachedMetrics(stale));

    const result = await getCampaignMetricsWithCache('camp-1', 'active');

    expect(result).toBeNull();
  });

  it('reconstructs the full response shape from cached columns', async () => {
    mockFindMetrics.mockResolvedValue(makeCachedMetrics());

    const result = await getCampaignMetricsWithCache('camp-1', 'closed');

    expect(result).toMatchObject({
      campaign_id: 'camp-1',
      campaign_name: 'Test Campaign',
      total_invited: 50,
      total_responded: 40,
      response_rate: 80,
      igrp: 4,
      igrp_label: 'Moderado',
      igrp_color: '#eab308',
      workers_high_risk_pct: 10,
      workers_critical_pct: 2,
      filter_context: { unit_id: null, sector_id: null, note: null },
    });
    expect(Array.isArray(result!.dimension_analysis)).toBe(true);
    expect(Array.isArray(result!.stacked_by_dimension)).toBe(true);
    expect(Array.isArray(result!.heatmap)).toBe(true);
    expect(Array.isArray(result!.gender_risk)).toBe(true);
    expect(Array.isArray(result!.age_risk)).toBe(true);
  });
});

// ── GET handler integration tests ─────────────────────────────────────────────

describe('GET /api/campaigns/[id]/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(ADM_USER);
    mockFindCampaign.mockResolvedValue(CLOSED_CAMPAIGN);
    mockFindMetrics.mockResolvedValue(null);
  });

  // ── Cache hit: closed campaign ─────────────────────────────────────────────

  it('returns cached data without calling surveyResponse.findMany for a closed campaign', async () => {
    mockFindMetrics.mockResolvedValue(makeCachedMetrics());

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.campaign_id).toBe('camp-1');
    expect(body.igrp).toBe(4);

    // Heavy aggregation must NOT have been called
    expect(mockFindResponses).not.toHaveBeenCalled();
    expect(mockUpsertMetrics).not.toHaveBeenCalled();
  });

  it('always returns cached data for closed campaigns regardless of cache age', async () => {
    const ancient = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days old
    mockFindMetrics.mockResolvedValue(makeCachedMetrics(ancient));

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.igrp).toBe(4);
    expect(mockFindResponses).not.toHaveBeenCalled();
  });

  // ── Cache miss: falls through to live computation ─────────────────────────

  it('falls back to live computation when no cache record exists', async () => {
    mockFindMetrics.mockResolvedValue(null);
    setupLiveComputationMocks();

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindResponses).toHaveBeenCalledTimes(1);
    expect(body.total_responded).toBe(2);
  });

  // ── Cache write after live computation ────────────────────────────────────

  it('upserts computed metrics into CampaignMetrics after live computation', async () => {
    mockFindMetrics.mockResolvedValue(null);
    setupLiveComputationMocks();

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    expect(mockUpsertMetrics).toHaveBeenCalledTimes(1);
    const upsertCall = mockUpsertMetrics.mock.calls[0][0];
    expect(upsertCall.where).toEqual({ campaign_id: 'camp-1' });
    expect(upsertCall.create).toMatchObject({
      campaign_id: 'camp-1',
      total_responded: 2,
    });
    expect(upsertCall.update).toMatchObject({
      total_responded: 2,
    });
  });

  it('does NOT upsert metrics when a filter (unit_id) is applied', async () => {
    mockFindMetrics.mockResolvedValue(null);
    setupLiveComputationMocks();

    const res = await GET(makeRequest('camp-1', '?unit_id=u-1'), makeParams());
    expect(res.status).toBe(200);
    expect(mockUpsertMetrics).not.toHaveBeenCalled();
  });

  it('does NOT use cache when a filter (unit_id) is applied', async () => {
    mockFindMetrics.mockResolvedValue(makeCachedMetrics());
    setupLiveComputationMocks();

    const res = await GET(makeRequest('camp-1', '?unit_id=u-1'), makeParams());
    expect(res.status).toBe(200);
    // Cache was never consulted for filtered request
    expect(mockFindMetrics).not.toHaveBeenCalled();
    // Live computation ran
    expect(mockFindResponses).toHaveBeenCalledTimes(1);
  });

  // ── Auth / status guards still work ───────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when campaign does not exist', async () => {
    mockFindCampaign.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-closed campaign with no cache', async () => {
    mockFindCampaign.mockResolvedValue(ACTIVE_CAMPAIGN);
    mockFindMetrics.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(400);
  });

  it('returns 403 for an RH user accessing another company campaign', async () => {
    mockGetAuthUser.mockResolvedValue({ user_id: 'rh-1', role: 'RH', company_id: 'co-OTHER' });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  // ── Suppression: dimensions must be null when group total < 5 ─────────────

  it('suppressed group with 4 respondents returns suppressed:true and dimensions:null', async () => {
    mockFindMetrics.mockResolvedValue(null);
    // 4 responses, all gender 'M' → one gender group with total=4 (<5 → suppressed)
    mockFindResponses.mockResolvedValue([
      makeSurveyResponse('r-1'),
      makeSurveyResponse('r-2'),
      makeSurveyResponse('r-3'),
      makeSurveyResponse('r-4'),
    ]);
    mockCountInvitations.mockResolvedValue(10);
    mockFindUnits.mockResolvedValue([]);
    mockFindSectors.mockResolvedValue([]);
    mockFindPositions.mockResolvedValue([]);
    mockUpsertMetrics.mockResolvedValue({});

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    const maleGroup = body.gender_risk.find((g: { gender: string }) => g.gender === 'Masculino');
    expect(maleGroup).toBeDefined();
    expect(maleGroup.suppressed).toBe(true);
    expect(maleGroup.dimensions).toBeNull();
  });

  it('non-suppressed group with 5 respondents returns suppressed:false and non-null dimensions', async () => {
    mockFindMetrics.mockResolvedValue(null);
    // 5 responses, all gender 'F' → one gender group with total=5 (≥5 → not suppressed)
    const makeFemaleSurveyResponse = (id: string) => ({ ...makeSurveyResponse(id), gender: 'F' });
    mockFindResponses.mockResolvedValue([
      makeFemaleSurveyResponse('r-1'),
      makeFemaleSurveyResponse('r-2'),
      makeFemaleSurveyResponse('r-3'),
      makeFemaleSurveyResponse('r-4'),
      makeFemaleSurveyResponse('r-5'),
    ]);
    mockCountInvitations.mockResolvedValue(10);
    mockFindUnits.mockResolvedValue([]);
    mockFindSectors.mockResolvedValue([]);
    mockFindPositions.mockResolvedValue([]);
    mockUpsertMetrics.mockResolvedValue({});

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    const femGroup = body.gender_risk.find((g: { gender: string }) => g.gender === 'Feminino');
    expect(femGroup).toBeDefined();
    expect(femGroup.suppressed).toBe(false);
    expect(femGroup.dimensions).not.toBeNull();
    expect(typeof femGroup.dimensions).toBe('object');
  });

  it('suppressed group with 0 respondents returns suppressed:true and dimensions:null', async () => {
    mockFindMetrics.mockResolvedValue(null);
    // Only 'F' responses exist; 'M' group would be absent, but age_range 'Nao informado'
    // can exist with 0 — instead test via a group that gets 0 by having all responses
    // carry an age we can isolate. Use a single response with age '65+' (total=1 < 5).
    const singleResp = { ...makeSurveyResponse('r-1'), gender: 'M', age_range: '65+' };
    mockFindResponses.mockResolvedValue([singleResp]);
    mockCountInvitations.mockResolvedValue(10);
    mockFindUnits.mockResolvedValue([]);
    mockFindSectors.mockResolvedValue([]);
    mockFindPositions.mockResolvedValue([]);
    mockUpsertMetrics.mockResolvedValue({});

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    // The age group '65+' has total=1 → suppressed
    const ageGroup = body.age_risk.find((g: { age_range: string }) => g.age_range === '65+');
    expect(ageGroup).toBeDefined();
    expect(ageGroup.suppressed).toBe(true);
    expect(ageGroup.dimensions).toBeNull();
  });
});
