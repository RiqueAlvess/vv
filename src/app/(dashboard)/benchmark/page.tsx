'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { IgrpTimeline } from '@/components/dashboard/igrp-timeline';
import { DemographicTable } from '@/components/dashboard/demographic-table';
import { Activity } from 'lucide-react';
import type { Campaign } from '@/types';

export default function BenchmarkPage() {
  const { get } = useApi();
  const [selectedId, setSelectedId] = useState('');

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns', 'closed'],
    queryFn: async () => {
      const res = await get('/api/campaigns?limit=100');
      if (!res.ok) throw new Error('Erro ao carregar campanhas');
      const body = await res.json();
      return ((body.data ?? []) as Campaign[]).filter((c) => c.status === 'closed');
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: timelinePoints = [] } = useQuery<{
    campaign_id: string; campaign_name: string; end_date: string; campaign_type: string; igrp: number;
  }[]>({
    queryKey: ['igrp-timeline'],
    queryFn: async () => {
      const res = await get('/api/campaigns/igrp-timeline');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const effectiveId = selectedId || campaigns[0]?.id || '';

  const { data: dashData, isLoading: loadingDash } = useQuery<Record<string, unknown>>({
    queryKey: ['dashboard', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const res = await get(`/api/campaigns/${effectiveId}/dashboard`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!effectiveId,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benchmarks & Evolução</h1>
          <p className="text-muted-foreground text-sm">
            Linha do tempo IGRP e comparativo demográfico por campanha
          </p>
        </div>
        {campaigns.length > 0 && (
          <Select value={effectiveId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Selecione uma campanha" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <IgrpTimeline points={timelinePoints} onCampaignClick={setSelectedId} />

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
          Nenhuma campanha encerrada disponível.
        </div>
      ) : loadingDash ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : dashData && Array.isArray(dashData.dimension_analysis) ? (
        <DemographicTable
          dimensionAnalysis={dashData.dimension_analysis as { key: string; name: string; nr: number }[]}
          genderRisk={(dashData.gender_risk as { gender: string; dimensions: Record<string, number>; total_responses: number }[]) ?? []}
          ageRisk={(dashData.age_risk as { age_range: string; dimensions: Record<string, number>; total_responses: number }[]) ?? []}
        />
      ) : (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          <Activity className="h-4 w-4 mr-2" />
          Selecione uma campanha encerrada para ver o comparativo demográfico
        </div>
      )}
    </div>
  );
}
