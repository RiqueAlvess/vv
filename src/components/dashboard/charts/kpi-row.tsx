'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, BarChart3, AlertTriangle } from 'lucide-react';

export function KpiRow({ data }: { data: Record<string, unknown> }) {
  const igrpLabel = data.igrp_label as string;
  const igrpColor = data.igrp_color as string;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Card 1 — Participantes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Participantes
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {(data.total_responded as number).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">total de respondentes</p>
        </CardContent>
      </Card>

      {/* Card 2 — IGRP */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            IGRP
          </CardTitle>
          <BarChart3 className="h-4 w-4" style={{ color: igrpColor }} />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{((data.igrp as number) ?? 0).toFixed(1)}</p>
          <Badge
            className="mt-1 text-white text-xs"
            style={{ backgroundColor: igrpColor }}
          >
            {igrpLabel}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">índice geral (1–16)</p>
        </CardContent>
      </Card>

      {/* Card 3 — Em Risco Alto */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Em Risco Alto
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-orange-500">
            {data.workers_high_risk_pct as number}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">respondentes com ao menos 1 dimensão NR ≥ 9</p>
        </CardContent>
      </Card>
    </div>
  );
}
