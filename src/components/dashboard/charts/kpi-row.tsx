'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, BarChart3, AlertTriangle, UserCheck } from 'lucide-react';

/* ─── Gauge Chart (velocímetro de taxa de adesão) ─────────────────────────── */
function GaugeChart({ value }: { value: number }) {
  const cx = 60, cy = 56, r = 44;
  const sw = 10; // stroke width

  // Convert 0–100 % to a point on the upper semicircle
  // 0% = leftmost (angle π), 100% = rightmost (angle 0)
  const pt = (pct: number) => {
    const a = Math.PI - (pct / 100) * Math.PI;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };

  // SVG arc from startPct → endPct (sweep-flag=0 = upper arc)
  const arc = (s: number, e: number) => {
    const { x: sx, y: sy } = pt(s);
    const { x: ex, y: ey } = pt(e);
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 0 0 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  };

  // Needle
  const needleA = Math.PI - (value / 100) * Math.PI;
  const nLen = r - 10;
  const nx = (cx + nLen * Math.cos(needleA)).toFixed(2);
  const ny = (cy - nLen * Math.sin(needleA)).toFixed(2);

  const color = value >= 70 ? '#22c55e' : value >= 60 ? '#eab308' : value >= 40 ? '#f97316' : '#ef4444';
  const label = value >= 70 ? 'Adequado' : value >= 60 ? 'Regular' : value >= 40 ? 'Atenção' : 'Crítico';

  return (
    <svg viewBox="0 0 120 72" className="w-full" style={{ maxHeight: '80px' }}>
      {/* Gray background for full arc */}
      <path d={arc(0, 100)} fill="none" stroke="#e5e7eb" strokeWidth={sw} strokeLinecap="butt" />

      {/* Colored zones (always visible — all 4 shown) */}
      <path d={arc(0,  39)} fill="none" stroke="#ef4444" strokeWidth={sw} />
      <path d={arc(40, 59)} fill="none" stroke="#f97316" strokeWidth={sw} />
      <path d={arc(60, 69)} fill="none" stroke="#eab308" strokeWidth={sw} />
      <path d={arc(70, 100)} fill="none" stroke="#22c55e" strokeWidth={sw} />

      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#1f2937" />

      {/* Labels */}
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="11" fontWeight="bold" fill={color}>
        {value}%
      </text>
      <text x={cx} y={cy + 23} textAnchor="middle" fontSize="8" fill="#9ca3af">
        {label}
      </text>

      {/* Scale anchors */}
      <text x="10" y={cy + 4} textAnchor="middle" fontSize="7" fill="#d1d5db">0</text>
      <text x="111" y={cy + 4} textAnchor="middle" fontSize="7" fill="#d1d5db">100</text>
    </svg>
  );
}

/* ─── Thermometer Chart (termômetro IGRP) ─────────────────────────────────── */
function ThermometerChart({ igrp }: { igrp: number }) {
  const maxVal = 10;
  const clamp = Math.min(Math.max(igrp, 0), maxVal);

  // Bar geometry
  const bx = 8, bw = 10;
  const top = 4, bottom = 82;
  const bh = bottom - top;

  // Zone proportions relative to [0, maxVal]
  // 🔴 7–10  (30 %)
  // 🟡 5–6.9 (20 %)
  // 🟢 0–4.9 (50 %)
  const redH    = (3.1 / maxVal) * bh;
  const yellowH = (2.0 / maxVal) * bh;
  const greenH  = bh - redH - yellowH;

  const redY    = top;
  const yellowY = redY + redH;
  const greenY  = yellowY + yellowH;

  // Marker Y: high value → near top (low y in SVG)
  const markerY = bottom - (clamp / maxVal) * bh;

  const color = igrp >= 7 ? '#ef4444' : igrp >= 5 ? '#eab308' : '#22c55e';

  return (
    <svg viewBox="0 0 34 90" style={{ height: '90px', minWidth: '34px' }}>
      {/* Zone rectangles */}
      <rect x={bx} y={redY}    width={bw} height={redH}    fill="#ef4444" rx="3" />
      <rect x={bx} y={yellowY} width={bw} height={yellowH} fill="#eab308" />
      <rect x={bx} y={greenY}  width={bw} height={greenH}  fill="#22c55e" rx="3" />

      {/* Zone dividers */}
      <line x1={bx} y1={yellowY} x2={bx + bw} y2={yellowY} stroke="white" strokeWidth="1.2" />
      <line x1={bx} y1={greenY}  x2={bx + bw} y2={greenY}  stroke="white" strokeWidth="1.2" />

      {/* Marker line across bar */}
      <line
        x1={bx - 2} y1={markerY} x2={bx + bw + 2} y2={markerY}
        stroke="white" strokeWidth="2" strokeLinecap="round"
      />

      {/* Arrow pointing right from bar */}
      <polygon
        points={`${bx + bw + 2},${markerY - 4} ${bx + bw + 2},${markerY + 4} ${bx + bw + 9},${markerY}`}
        fill={color}
      />

      {/* Scale labels */}
      <text x={bx + bw / 2} y={redY - 1}   textAnchor="middle" fontSize="6.5" fill="#9ca3af">10</text>
      <text x={bx + bw / 2} y={bottom + 8}  textAnchor="middle" fontSize="6.5" fill="#9ca3af">0</text>

      {/* Threshold markers */}
      <line x1={bx - 3} y1={yellowY} x2={bx - 1} y2={yellowY} stroke="#eab308" strokeWidth="1" />
      <line x1={bx - 3} y1={greenY}  x2={bx - 1} y2={greenY}  stroke="#22c55e" strokeWidth="1" />
      <text x={bx - 4} y={yellowY + 3} textAnchor="end" fontSize="6" fill="#9ca3af">7</text>
      <text x={bx - 4} y={greenY  + 3} textAnchor="end" fontSize="6" fill="#9ca3af">5</text>
    </svg>
  );
}

/* ─── KPI Row ─────────────────────────────────────────────────────────────── */
export function KpiRow({ data }: { data: Record<string, unknown> }) {
  const igrpLabel = data.igrp_label as string;
  const igrpColor = data.igrp_color as string;
  const igrp      = (data.igrp as number) ?? 0;
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

      {/* Card 2 — Respondentes + Gauge (velocímetro de taxa de adesão) */}
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
          <GaugeChart value={responseRate} />
        </CardContent>
      </Card>

      {/* Card 3 — IGRP + Termômetro */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
            Índice Geral de Riscos Psicossociais (IGRP)
          </CardTitle>
          <BarChart3 className="h-4 w-4 shrink-0" style={{ color: igrpColor }} />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {/* Left: numeric data */}
            <div className="flex-1">
              <p className="text-3xl font-bold">{igrp.toFixed(1)}</p>
              <Badge
                className="mt-1 text-white text-xs"
                style={{ backgroundColor: igrpColor }}
              >
                {igrpLabel}
              </Badge>
            </div>

            {/* Right: thermometer with tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <ThermometerChart igrp={igrp} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-center leading-relaxed">
                  Indicador que resume, em um único número, o nível de risco psicossocial da organização.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
