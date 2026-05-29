'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface DimensionNR {
  key: string;
  name: string;
  nr: number;
  nr_color: string;
}

interface DeltaStripProps {
  sectorDimensions: DimensionNR[];
  campaignDimensions: DimensionNR[];
  sectorName?: string;
}

export function DeltaStrip({ sectorDimensions, campaignDimensions, sectorName }: DeltaStripProps) {
  const campaignMap = Object.fromEntries(campaignDimensions.map((d) => [d.key, d]));

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {sectorName ? `Setor: ${sectorName}` : 'Setor selecionado'} vs. média da campanha
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {sectorDimensions.map((dim) => {
          const campaign = campaignMap[dim.key];
          if (!campaign) return null;
          const delta = Number((dim.nr - campaign.nr).toFixed(1));
          const isWorse = delta > 0.1;
          const isBetter = delta < -0.1;

          return (
            <Card key={dim.key} className="border-border/60">
              <CardContent className="p-3 space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground leading-tight line-clamp-2">
                  {dim.name}
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className="text-lg font-bold leading-none"
                    style={{ color: dim.nr_color }}
                  >
                    {dim.nr.toFixed(1)}
                  </span>
                </div>
                <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
                  isWorse ? 'text-red-500' : isBetter ? 'text-emerald-500' : 'text-muted-foreground'
                }`}>
                  {isWorse ? (
                    <TrendingUp className="h-3 w-3 shrink-0" />
                  ) : isBetter ? (
                    <TrendingDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <Minus className="h-3 w-3 shrink-0" />
                  )}
                  <span>{delta > 0 ? '+' : ''}{delta} vs campanha</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
