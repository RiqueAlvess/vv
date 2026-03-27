'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

function GaugeInline({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 70 ? '#22c55e' :
    pct >= 50 ? '#eab308' : '#ef4444';

  const cx = 60, cy = 60, r = 48;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const valueAngle = 180 - (pct / 100) * 180;

  const endX = cx + r * Math.cos(toRad(valueAngle));
  const endY = cy + r * Math.sin(toRad(valueAngle));

  const largeArc = pct > 50 ? 1 : 0;

  const bgStartX = cx - r;
  const bgEndX = cx + r;

  return (
    <svg viewBox="0 0 120 68" className="w-full max-w-[180px]" style={{ overflow: 'visible' }}>
      {/* Red zone: 0-50% = 180° to 90° */}
      <path
        d={`M ${bgStartX} ${cy} A ${r} ${r} 0 0 1 ${cx} ${cy - r}`}
        fill="none" stroke="#fecaca" strokeWidth="12" strokeLinecap="butt"
      />
      {/* Yellow zone: 50-70% = 90° to 54° */}
      <path
        d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(toRad(54))} ${cy + r * Math.sin(toRad(54))}`}
        fill="none" stroke="#fef9c3" strokeWidth="12" strokeLinecap="butt"
      />
      {/* Green zone: 70-100% = 54° to 0° */}
      <path
        d={`M ${cx + r * Math.cos(toRad(54))} ${cy + r * Math.sin(toRad(54))} A ${r} ${r} 0 0 1 ${bgEndX} ${cy}`}
        fill="none" stroke="#bbf7d0" strokeWidth="12" strokeLinecap="butt"
      />

      {/* Value arc (solid color, on top) */}
      {pct > 0 && (
        <path
          d={`M ${bgStartX} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
        />
      )}

      {/* Needle */}
      {(() => {
        const needleAngle = valueAngle;
        const needleLen = r - 8;
        const nx = cx + needleLen * Math.cos(toRad(needleAngle));
        const ny = cy + needleLen * Math.sin(toRad(needleAngle));
        return (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="4" fill="#1e293b" />
          </>
        );
      })()}

      {/* Zone labels */}
      <text x="8"  y="66" fontSize="7" fill="#ef4444" textAnchor="middle">0%</text>
      <text x="60" y="10" fontSize="7" fill="#eab308" textAnchor="middle">50%</text>
      <text x="112" y="66" fontSize="7" fill="#22c55e" textAnchor="middle">100%</text>

      {/* Center value */}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

export function KpiRow({ data }: { data: Record<string, unknown> }) {
  const responseRate = data.response_rate as number;
  const igrpLabel = data.igrp_label as string;
  const igrpColor = data.igrp_color as string;

  const rateColor =
    responseRate >= 70 ? '#22c55e' :
    responseRate >= 50 ? '#eab308' : '#ef4444';

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
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-0 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Taxa de Adesão
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-0 pb-3">
          <GaugeInline value={responseRate} />
          <p className="text-xs mt-1" style={{ color: rateColor }}>
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
