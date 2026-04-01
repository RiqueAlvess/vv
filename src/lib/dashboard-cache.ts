/**
 * Campaign dashboard cache helpers — extracted for testability.
 * (Next.js route files cannot export non-HTTP handler functions.)
 */
import { prisma } from '@/lib/prisma';

export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type StoredMetrics = Awaited<ReturnType<typeof prisma.campaignMetrics.findUnique>>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Guard against legacy/incompatible cache rows.
 * We only serve cached payloads that match the dashboard contract expected by UI.
 */
function hasCompatibleDashboardShape(cached: NonNullable<StoredMetrics>): boolean {
  if (!isArray(cached.dimension_scores)) return false;
  if (!isArray(cached.heatmap_data)) return false;
  if (!isArray(cached.top_critical_groups)) return false;
  if (!isArray(cached.scores_by_gender)) return false;
  if (!isArray(cached.scores_by_age)) return false;

  const rd = cached.risk_distribution;
  if (!isObject(rd)) return false;
  if (!isArray(rd.stacked_by_dimension)) return false;
  if (!isArray(rd.stacked_by_question)) return false;

  const tc = cached.top_critical_sectors;
  if (!isObject(tc)) return false;
  if (!isArray(tc.top_sectors_by_nr)) return false;
  if (!isArray(tc.top_positions_by_nr)) return false;

  const dd = cached.demographic_data;
  if (!isObject(dd)) return false;
  if (!isObject(dd.gender_distribution)) return false;
  if (!isObject(dd.age_distribution)) return false;

  return true;
}

export function buildPayloadFromCache(
  campaignId: string,
  cached: NonNullable<StoredMetrics>,
): Record<string, unknown> {
  const rd = (cached.risk_distribution ?? {}) as Record<string, unknown>;
  const tc = (cached.top_critical_sectors ?? {}) as Record<string, unknown>;
  const dd = (cached.demographic_data ?? {}) as Record<string, unknown>;

  return {
    campaign_id: campaignId,
    campaign_name: rd.campaign_name ?? null,
    total_invited: cached.total_invited,
    total_responded: cached.total_responded,
    response_rate: Number(cached.response_rate),
    igrp: Number(cached.igrp ?? 0),
    igrp_label: rd.igrp_label ?? null,
    igrp_color: rd.igrp_color ?? null,
    workers_high_risk_pct: rd.workers_high_risk_pct ?? 0,
    workers_critical_pct: rd.workers_critical_pct ?? 0,
    dimension_analysis: cached.dimension_scores ?? [],
    stacked_by_dimension: rd.stacked_by_dimension ?? [],
    stacked_by_question: rd.stacked_by_question ?? [],
    heatmap: cached.heatmap_data ?? [],
    top_sectors_by_nr: tc.top_sectors_by_nr ?? [],
    top_positions_by_nr: tc.top_positions_by_nr ?? [],
    position_table: cached.top_critical_groups ?? [],
    gender_distribution: dd.gender_distribution ?? {},
    age_distribution: dd.age_distribution ?? {},
    gender_risk: cached.scores_by_gender ?? [],
    age_risk: cached.scores_by_age ?? [],
    filter_context: { unit_id: null, sector_id: null, note: null },
  };
}

/**
 * Attempt to serve dashboard metrics from the CampaignMetrics cache.
 *
 * Rules:
 *  - closed campaign  → always return cached data (immutable result set)
 *  - active campaign  → return cached data only when < 5 min old
 *  - missing / empty cache → return null (caller falls through to live compute)
 */
export async function getCampaignMetricsWithCache(
  campaignId: string,
  status: string,
): Promise<Record<string, unknown> | null> {
  const cached = await prisma.campaignMetrics.findUnique({
    where: { campaign_id: campaignId },
  });

  if (!cached || !cached.risk_distribution) return null;
  if (!hasCompatibleDashboardShape(cached)) return null;

  if (status === 'closed') {
    return buildPayloadFromCache(campaignId, cached);
  }

  const ageMs = Date.now() - new Date(cached.updated_at).getTime();
  if (ageMs < CACHE_TTL_MS) {
    return buildPayloadFromCache(campaignId, cached);
  }

  return null;
}
