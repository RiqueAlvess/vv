'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ActionPlanPanel } from '@/components/action-plan/action-plan-panel';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface CampaignInfo {
  id: string;
  name: string;
  status: string;
}

export default function ActionPlanDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setCampaign(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  const canEdit = user?.role === 'ADM' || user?.role === 'RH';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/action-plans">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Planos de Ação
          </Link>
        </Button>
        {loading ? (
          <Skeleton className="h-5 w-48" />
        ) : campaign ? (
          <span className="text-sm text-muted-foreground">
            {campaign.name}
          </span>
        ) : null}
      </div>

      <ActionPlanPanel
        campaignId={campaignId}
        campaignStatus={campaign?.status ?? 'closed'}
        canEdit={canEdit}
      />
    </div>
  );
}
