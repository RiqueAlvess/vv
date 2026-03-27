'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

function GaugeInline({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));

  const color =
    pct >= 70 ? '#22c55e' :
    pct >= 50 ? '#eab308' : '#ef4444';

  // Needle: -90deg = 0%, 0deg = 50%, +90deg = 100%
  // Transform: rotate from -90 to +90 based on pct
  const rotation = -90 + (pct / 100) * 180;

  return (
    <div className="flex flex-col items-center w-full">
      <svg
        viewBox="0 0 120 70"
        className="w-full max-w-[180px]"
      >
        {/* Red zone arc: left quarter */}
        <path
          d="M 16 60 A 44 44 0 0 1 60 16"
          fill="none"
          stroke="#fca5a5"
          strokeWidth="12"
          strokeLinecap="butt"
        />
        {/* Yellow zone arc: middle segment */}
        <path
          d="M 60 16 A 44 44 0 0 1 84 23"
          fill="none"
          stroke="#fde047"
          strokeWidth="12"
          strokeLinecap="butt"
        />
        {/* Green zone arc: right quarter */}
        <path
          d="M 84 23 A 44 44 0 0 1 104 60"
          fill="none"
          stroke="#86efac"
          strokeWidth="12"
          strokeLinecap="butt"
        />

        {/* Needle group — rotates around center (60, 60) */}
        <g transform={`rotate(${rotation}, 60, 60)`}>
          <line
            x1="60" y1="60"
            x2="60" y2="22"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Center cap */}
        <circle cx="60" cy="60" r="4" fill="#1e293b" />

        {/* Value label */}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill={color}
        >
          {pct.toFixed(1)}%
        </text>

        {/* Zone labels */}
        <text x="10" y="68" textAnchor="middle" fontSize="7" fill="#94a3b8">0%</text>
        <text x="60" y="12" textAnchor="middle" fontSize="7" fill="#eab308">50%</text>
        <text x="110" y="68" textAnchor="middle" fontSize="7" fill="#22c55e">100%</text>
      </svg>
    </div>
  );
}

export function KpiRow({ data }: { data: Record<string, unknown> }) {
  const responseRate = data.response_rate as number;
  const igrpLabel = data.igrp_label as string;
  const igrpColor = data.igrp_color as string;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1 — Convidados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Convidados
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {(data.total_invited as number).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.total_responded as number} responderam
          </p>
        </CardContent>
      </Card>

      {/* Card 2 — Taxa de Adesão with Gauge */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Taxa de Adesão
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col items-center px-3 pt-1 pb-3">
          <GaugeInline value={responseRate} />
          <p className="text-xs text-muted-foreground -mt-1">
            {(data.total_responded as number)} de {(data.total_invited as number)} responderam
          </p>
        </CardContent>
      </Card>

      {/* Card 3 — IGRP */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            IGRP
          </CardTitle>
          <BarChart3 className="h-4 w-4" style={{ color: igrpColor }} />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{(data.igrp as number).toFixed(1)}</p>
          <Badge
            className="mt-1 text-white text-xs"
            style={{ backgroundColor: igrpColor }}
          >
            {igrpLabel}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">índice geral (1–16)</p>
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
          <p className="text-xs text-muted-foreground mt-1">trabalhadores NR ≥ 9</p>
        </CardContent>
      </Card>
    </div>
  );
}
