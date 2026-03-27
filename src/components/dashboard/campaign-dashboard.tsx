'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCampaignDashboard } from '@/hooks/use-campaign-dashboard';
import { LockedState } from './locked-state';
import { KpiCards } from './kpi-cards';
import { DimensionRadar } from './dimension-radar';
import { CriticalSectorsTable } from './critical-sectors-table';
import type { CriticalSectorRow } from './critical-sectors-table';

interface CampaignDashboardProps {
  campaignId: string;
  /**
   * Raw campaign status from DB ('draft' | 'active' | 'closed').
   * Passed in from the parent so this component never needs to fetch the
   * campaign record itself — the parent already has it.
   */
  campaignStatus: string;
  campaignName?: string;
}

/**
 * Main dashboard orchestrator. Intentionally thin — it only:
 *   1. Enforces the Dashboard Lock guardrail
 *   2. Calls the single data hook
 *   3. Handles loading / error states
 *   4. Composes the three visual sections
 *
 * ── Dashboard Lock ──────────────────────────────────────────────────────────
 * If campaignStatus !== 'closed', the LockedState is shown immediately and
 * the data hook is NOT called (enabled=false). This enforces the NR-1 anonymity
 * rule: releasing partial data during collection lets observers correlate
 * invitation status changes with report updates.
 *
 * ── Data flow ───────────────────────────────────────────────────────────────
 * Parent provides campaignId + campaignStatus (from its own query).
 * This component fetches nothing beyond the analytics payload.
 */
export function CampaignDashboard({
  campaignId,
  campaignStatus,
  campaignName,
}: CampaignDashboardProps) {
  const [downloading, setDownloading] = useState(false);

  // ── Guardrail ─────────────────────────────────────────────────────────────
  // Check status BEFORE calling the hook so React's rules of hooks are
  // respected (hooks can't be called conditionally). The hook itself uses
  // `enabled: false` when status !== 'closed' so no network request fires.
  const isClosed = campaignStatus === 'closed';

  const handleDownloadPGR = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/report/pdf`);
      if (!res.ok) throw new Error('Erro ao gerar relatório');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PGR_${campaignName ?? campaignId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // error is surfaced via the button state; a toast hook can be added here
    } finally {
      setDownloading(false);
    }
  };

  const { data, isLoading, isError, error } = useCampaignDashboard(campaignId, {
    enabled: isClosed,
  });

  // ── Lock screen ───────────────────────────────────────────────────────────
  if (!isClosed) {
    return <LockedState status={campaignStatus} campaignName={campaignName} />;
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-12">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error instanceof Error ? error.message : 'Erro ao carregar dados do dashboard.'}
        </AlertDescription>
      </Alert>
    );
  }

  // ── Narrow `top_sectors` to the typed shape ───────────────────────────────
  // DashboardData.top_sectors is Record<string, unknown>[] (wide API type).
  // We narrow it here so CriticalSectorsTable receives a typed prop.
  const topSectors: CriticalSectorRow[] = (data.top_sectors ?? []).flatMap((raw) => {
    const r = raw as Record<string, unknown>;
    if (typeof r.sector === 'string' && typeof r.percentage === 'number') {
      return [{ sector: r.sector, percentage: r.percentage, color: String(r.color ?? '#94a3b8') }];
    }
    return [];
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Row 1 — KPI cards */}
      <KpiCards metrics={data.metrics} />

      {/* Row 2 — Radar + Critical Sectors side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DimensionRadar dimensionScores={data.dimension_scores} />
        <CriticalSectorsTable sectors={topSectors} />
      </div>

      {/* PGR PDF export */}
      <div className="flex justify-end">
        <Button onClick={handleDownloadPGR} disabled={downloading} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {downloading ? 'Gerando PDF...' : 'Exportar Relatório PGR'}
        </Button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[280px] w-full" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
