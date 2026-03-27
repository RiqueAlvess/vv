'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

function GaugeInline({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));

  const color =
    pct >= 70 ? '#22c55e' :
    pct >= 50 ? '#eab308' : '#ef4444';

  // Gauge is a top-half semicircle
  // Angles in SVG: 0° = right, 90° = down, 180° = left
  // We sweep from left (180°) to right (0°) using sweep-flag=1 (clockwise in SVG coords)
  // 0%   → needle at 180° (far left)
  // 50%  → needle at 90°  (top)
  // 100% → needle at 0°   (far right)

  const cx = 60;
  const cy = 58;
  const r  = 44;
  const strokeW = 11;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Point on the arc at a given degree
  const pt = (deg: number, radius = r) => ({
    x: cx + radius * Math.cos(toRad(deg)),
    y: cy + radius * Math.sin(toRad(deg)),
  });

  // Draw a clockwise arc from degStart to degEnd (SVG sweep-flag=1)
  // degStart and degEnd are standard math angles
  const arc = (degStart: number, degEnd: number, radius = r) => {
    const s = pt(degStart, radius);
    const e = pt(degEnd, radius);
    const sweep = degEnd < degStart ? 1 : 0; // clockwise = going from 180 toward 0
    const large = Math.abs(degStart - degEnd) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} ${sweep} ${e.x} ${e.y}`;
  };

  // Degree for a given percentage (180° at 0%, 0° at 100%)
  const degFor = (p: number) => 180 - (p / 100) * 180;

  const needleDeg = degFor(pct);
  const needlePt  = pt(needleDeg, r - 8);

  return (
    <svg
      viewBox="0 0 120 75"
      className="w-full max-w-[190px]"
      aria-label={`Taxa de adesão: ${pct.toFixed(1)}%`}
    >
      {/* ── Zone bands (background, drawn first) ── */}
      {/* Red: 0% → 50% (180° → 90°) */}
      <path
        d={arc(180, 90)}
        fill="none"
        stroke="#fca5a5"
        strokeWidth={strokeW}
        strokeLinecap="butt"
      />
      {/* Yellow: 50% → 70% (90° → 54°) */}
      <path
        d={arc(90, degFor(70))}
        fill="none"
        stroke="#fde047"
        strokeWidth={strokeW}
        strokeLinecap="butt"
      />
      {/* Green: 70% → 100% (54° → 0°) */}
      <path
        d={arc(degFor(70), 0)}
        fill="none"
        stroke="#86efac"
        strokeWidth={strokeW}
        strokeLinecap="butt"
      />

      {/* ── Value arc (solid, drawn over zones) ── */}
      {pct > 0.5 && (
        <path
          d={arc(180, needleDeg)}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      )}

      {/* ── Needle ── */}
      <line
        x1={cx} y1={cy}
        x2={needlePt.x} y2={needlePt.y}
        stroke="#1e293b"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4" fill="#1e293b" />

      {/* ── Zone boundary ticks ── */}
      {[
        { pct: 50, label: '50%', color: '#eab308' },
        { pct: 70, label: '70%', color: '#22c55e' },
      ].map(({ pct: p, label, color: c }) => {
        const inner = pt(degFor(p), r - strokeW / 2 - 2);
        const outer = pt(degFor(p), r + strokeW / 2 + 2);
        return (
          <g key={p}>
            <line
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={c}
              strokeWidth="1.5"
            />
            <text
              x={pt(degFor(p), r + strokeW / 2 + 9).x}
              y={pt(degFor(p), r + strokeW / 2 + 9).y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="6.5"
              fill={c}
              fontWeight="600"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* ── Edge labels ── */}
      <text x={pt(180, r + strokeW / 2 + 7).x} y={pt(180, r + strokeW / 2 + 7).y}
        textAnchor="middle" dominantBaseline="middle" fontSize="6.5" fill="#94a3b8">
        0%
      </text>
      <text x={pt(0, r + strokeW / 2 + 7).x} y={pt(0, r + strokeW / 2 + 7).y}
        textAnchor="middle" dominantBaseline="middle" fontSize="6.5" fill="#94a3b8">
        100%
      </text>

      {/* ── Value text (positioned below needle pivot, inside the arc) ── */}
      <text
        x={cx}
        y={cy + 13}
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill={color}
      >
        {pct.toFixed(1)}%
      </text>
    </svg>
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
