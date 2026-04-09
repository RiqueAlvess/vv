'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, BarChart3, AlertTriangle, UserCheck } from 'lucide-react';

export function KpiRow({ data }: { data: Record<string, unknown> }) {
  const igrpLabel = data.igrp_label as string;
  const igrpColor = data.igrp_color as string;
  const totalEmployees = (data.total_employees as number) ?? 0;
  const totalResponded = (data.total_responded as number) ?? 0;
  const responseRate = totalEmployees > 0
    ? Math.round((totalResponded / totalEmployees) * 100)
    : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1 — Total de Funcionários */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Funcionários
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {totalEmployees.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">cadastrados na campanha</p>
        </CardContent>
      </Card>

      {/* Card 2 — Respondentes + Taxa */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Respondentes
          </CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {totalResponded.toLocaleString('pt-BR')}
          </p>
          <div className="mt-2">
            <Progress value={responseRate} className="h-1.5" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{responseRate}%</span>{' '}
            de adesão
          </p>
        </CardContent>
      </Card>

      {/* Card 3 — IGRP */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
            Índice Geral de Riscos Psicossociais (IGRP)
          </CardTitle>
          <BarChart3 className="h-4 w-4 shrink-0" style={{ color: igrpColor }} />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{((data.igrp as number) ?? 0).toFixed(1)}</p>
          <Badge
            className="mt-1 text-white text-xs"
            style={{ backgroundColor: igrpColor }}
          >
            {igrpLabel}
          </Badge>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Indicador que resume, em um único número, o nível de risco psicossocial da organização.
          </p>
        </CardContent>
      </Card>

      {/* Card 4 — Em Risco Alto */}
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
