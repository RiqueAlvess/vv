'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useApi } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LeadershipDashboard } from '@/components/dashboard/leadership-dashboard';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

interface CampaignInfo { id: string; name: string; status: string }
interface SectorInfo { id: string; name: string }

export default function LiderancaCampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user } = useAuth();
  const { get } = useApi();

  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [sector, setSector] = useState<SectorInfo | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.sector_id) { setLoadingMeta(false); return; }

    Promise.all([
      get(`/api/campaigns/${campaignId}`).then((r) => r.json()),
      get(`/api/campaigns/${campaignId}/units`).then((r) => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([camp, unitsRes]) => {
        if (camp.error) throw new Error(camp.error);
        setCampaign(camp as CampaignInfo);
        // Find the sector name across all units
        const units: { id: string; sectors: SectorInfo[] }[] = unitsRes?.data ?? [];
        for (const unit of units) {
          const found = unit.sectors?.find((s: SectorInfo) => s.id === user.sector_id);
          if (found) { setSector(found); break; }
        }
      })
      .catch((e: Error) => setMetaError(e.message))
      .finally(() => setLoadingMeta(false));
  }, [campaignId, user?.sector_id, get]);

  if (!user?.sector_id) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Seu usuário não possui setor atribuído. Contate o administrador.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/lideranca">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Meu Setor
          </Link>
        </Button>
        {loadingMeta ? (
          <Skeleton className="h-5 w-48" />
        ) : campaign ? (
          <span className="text-sm text-muted-foreground">{campaign.name}</span>
        ) : null}
      </div>

      {metaError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{metaError}</AlertDescription>
        </Alert>
      ) : loadingMeta ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <LeadershipDashboard
          campaignId={campaignId}
          sectorId={user.sector_id}
          sectorName={sector?.name}
        />
      )}
    </div>
  );
}
