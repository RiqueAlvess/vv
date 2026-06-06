'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { HSE_DIMENSIONS } from '@/lib/constants';

interface DimAnalysis { key: string; name: string; nr: number }

interface BenchmarkData {
  available: boolean;
  reason?: string;
  count?: number;
  min_required?: number;
  company_size?: string;
  median_igrp?: number;
  dim_medians?: Record<string, number>;
}

interface BenchmarkCardProps {
  dimensionAnalysis: DimAnalysis[];
}

export function BenchmarkCard({ dimensionAnalysis }: BenchmarkCardProps) {
  const [data, setData] = useState<BenchmarkData | null>(null);

  useEffect(() => {
    fetch('/api/benchmark', { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const myByKey = Object.fromEntries(dimensionAnalysis.map((d) => [d.key, d.nr]));

  if (!data.available) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Empresas do mesmo porte
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {data.company_size}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex text-[10px] text-muted-foreground mb-1 gap-2">
          <span className="flex-1">Dimensão</span>
          <span className="w-8 text-right">Você</span>
          <span className="w-8 text-right">Mediana</span>
          <span className="w-12 text-right">Delta</span>
        </div>
        {HSE_DIMENSIONS.map((dim) => {
          const myNR = myByKey[dim.key] ?? 0;
          const benchNR = data.dim_medians?.[dim.key] ?? 0;
          const delta = myNR - benchNR;
          const isWorse = delta > 0.3;
          const isBetter = delta < -0.3;
          return (
            <div key={dim.key} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-muted-foreground truncate">{dim.name}</span>
              <span className="w-8 text-right font-mono font-medium">{myNR.toFixed(1)}</span>
              <span className="w-8 text-right font-mono text-muted-foreground">{benchNR.toFixed(1)}</span>
              <span
                className={`w-12 text-right flex items-center justify-end gap-0.5 font-medium ${
                  isWorse ? 'text-red-500' : isBetter ? 'text-emerald-500' : 'text-muted-foreground'
                }`}
              >
                {isWorse ? <TrendingUp className="h-3 w-3 shrink-0" /> : isBetter ? <TrendingDown className="h-3 w-3 shrink-0" /> : <Minus className="h-3 w-3 shrink-0" />}
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </span>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground/60 pt-2 border-t mt-2">
          Benchmark baseado nos dados coletados anonimamente pela plataforma Asta.
        </p>
      </CardContent>
    </Card>
  );
}
