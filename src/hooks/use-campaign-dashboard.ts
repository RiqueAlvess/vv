'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from './use-api';
import type { DashboardData } from '@/types';

// ─── Query key factory ─────────────────────────────────────────────────────
//
// Factory (not a constant) because the key includes the campaignId.
// Callers invalidate or prefetch with the same factory:
//   queryClient.invalidateQueries({ queryKey: dashboardKey(id) })

export const dashboardKey = (campaignId: string) =>
  ['campaign-dashboard', campaignId] as const;

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Fetches and caches the full analytics payload for a closed campaign.
 *
 * `enabled` is set to false when the campaign is not closed so the request
 * is never fired — the guardrail in CampaignDashboard will render instead.
 * This prevents a wasted network round-trip that would always return a 400.
 *
 * staleTime: 10 minutes — analytics are computed once at campaign close and
 * stored in CampaignMetrics. They don't change unless someone calls
 * computeCampaignMetrics() explicitly.
 */
export function useCampaignDashboard(
  campaignId: string,
  options: { enabled?: boolean } = {}
) {
  const { get } = useApi();
  const enabled = options.enabled ?? true;

  return useQuery<DashboardData>({
    queryKey: dashboardKey(campaignId),
    queryFn: async () => {
      const res = await get(`/api/campaigns/${campaignId}/dashboard`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Erro ao carregar dashboard (HTTP ${res.status})`
        );
      }
      return res.json() as Promise<DashboardData>;
    },
    enabled: !!campaignId && enabled,
    staleTime: 10 * 60 * 1000, // 10 min — metrics are stable after campaign close
    retry: (failureCount, error) => {
      // Don't retry business-rule rejections (campaign not closed, no responses, etc.)
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('encerradas') || msg.includes('404') || msg.includes('403')) return false;
      return failureCount < 2;
    },
  });
}
