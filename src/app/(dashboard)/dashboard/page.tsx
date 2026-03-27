'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CampaignDashboard } from '@/components/dashboard/campaign-dashboard';
import { LockedState } from '@/components/dashboard/locked-state';
import { useApi } from '@/hooks/use-api';
import { Activity } from 'lucide-react';
import type { Campaign } from '@/types';

// ─── Query key ────────────────────────────────────────────────────────────
const CLOSED_CAMPAIGNS_KEY = ['campaigns', 'closed'] as const;

// ─── Page ─────────────────────────────────────────────────────────────────

/**
 * Dashboard page — thin campaign selector + CampaignDashboard drop-in.
 *
 * Responsibilities of THIS page:
 *   • Fetch the list of closed campaigns (for the selector)
 *   • Track which campaign is selected
 *   • Render <CampaignDashboard> which owns the analytics data fetch
 *     and all chart/table components
 *
 * Everything else (data fetching, guardrail, skeleton, charts) lives in
 * CampaignDashboard and its sub-components.
 *
 * NOTE: the page pre-filters to 'closed' campaigns because the selector
 * should only show campaigns with results. The guardrail inside
 * CampaignDashboard is still present as a safety net (e.g., if the status
 * changes between page load and campaign selection).
 */
export default function DashboardPage() {
  const { get } = useApi();
  const [selectedId, setSelectedId] = useState<string>('');

  // Fetch only closed campaigns for the selector
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: CLOSED_CAMPAIGNS_KEY,
    queryFn: async () => {
      const res = await get('/api/campaigns?limit=100');
      if (!res.ok) throw new Error('Erro ao carregar campanhas');
      const body = await res.json();
      return ((body.data ?? []) as Campaign[]).filter((c) => c.status === 'closed');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select the first campaign once the list loads
  const effectiveSelected = selectedId || campaigns[0]?.id || '';
  const selectedCampaign = campaigns.find((c) => c.id === effectiveSelected);

  // ── Selector loading skeleton ────────────────────────────────────────────
  if (loadingCampaigns) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── No closed campaigns ──────────────────────────────────────────────────
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Activity className="h-14 w-14 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold">Nenhuma campanha encerrada</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          O dashboard é liberado quando uma campanha é encerrada.
          Enquanto a coleta está ativa os dados ficam protegidos.
        </p>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header + campaign selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Resultados de risco psicossocial — NR-1 / HSE-IT
          </p>
        </div>
        <Select value={effectiveSelected} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dashboard body — guardrail is inside CampaignDashboard */}
      {effectiveSelected ? (
        <CampaignDashboard
          campaignId={effectiveSelected}
          campaignStatus={selectedCampaign?.status ?? 'closed'}
          campaignName={selectedCampaign?.name}
        />
      ) : (
        // Fallback: shouldn't happen since we auto-select, but safe to have
        <LockedState status="draft" />
      )}
    </div>
  );
}
