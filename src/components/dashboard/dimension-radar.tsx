'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { RISK_COLORS } from '@/lib/constants';
import type { RiskLevel } from '@/types';

interface DimensionRadarProps {
  /** Keyed by dimension key, e.g. { demandas: 2.4, controle: 1.8, … } */
  dimensionScores: Record<string, number>;
}

// ─── Risk classification (mirrors scoring.ts, no external import needed) ──

function getDimensionRisk(score: number, polarity: 'positive' | 'negative'): RiskLevel {
  if (polarity === 'negative') {
    if (score >= 3.1) return 'critico';
    if (score >= 2.1) return 'importante';
    if (score >= 1.1) return 'moderado';
    return 'aceitavel';
  } else {
    if (score <= 1.0) return 'critico';
    if (score <= 2.0) return 'importante';
    if (score <= 3.0) return 'moderado';
    return 'aceitavel';
  }
}

const RISK_LABELS: Record<RiskLevel, string> = {
  aceitavel: 'Aceitável',
  moderado: 'Moderado',
  importante: 'Importante',
  critico: 'Crítico',
};

// ─── Custom tooltip ────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { dimension: string; score: number; risk: RiskLevel } }[];
}) {
  if (!active || !payload?.length) return null;
  const { dimension, score, risk } = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{dimension}</p>
      <p className="text-muted-foreground">
        Score: <span className="font-medium text-foreground">{score.toFixed(2)}</span>
      </p>
      <p className="text-muted-foreground">
        Risco:{' '}
        <span className="font-semibold" style={{ color: RISK_COLORS[risk] }}>
          {RISK_LABELS[risk]}
        </span>
      </p>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Radar chart for the 7 HSE-IT dimensions with a risk-breakdown legend below.
 *
 * Layout:
 *   ┌──────────────────────────────────┐
 *   │  Radar chart (scale 0–4)        │
 *   │  — domain matches Likert scale  │
 *   │  — tooltip shows score + risk   │
 *   ├──────────────────────────────────┤
 *   │  7 dimension pills (2-col grid) │
 *   │  score  |  risk badge           │
 *   └──────────────────────────────────┘
 *
 * The radar FILL colour reflects overall IGRP risk (computed from the mean
 * NR across dimensions). Per-spoke risk is shown in the legend pills below
 * because Recharts RadarChart doesn't support per-spoke fill colours.
 */
export function DimensionRadar({ dimensionScores }: DimensionRadarProps) {
  const data = HSE_DIMENSIONS.map((dim) => {
    const score = dimensionScores[dim.key] ?? 0;
    const risk = getDimensionRisk(score, dim.type);
    return {
      dimension: dim.name,
      key: dim.key,
      score,
      risk,
      polarity: dim.type,
    };
  });

  // Overall fill colour: use the worst risk level present
  const worstRisk = getWorstRisk(data.map((d) => d.risk));
  const fillColor = RISK_COLORS[worstRisk];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dimensões HSE-IT</CardTitle>
        <CardDescription>Pontuação média por dimensão (escala 0–4)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Radar chart */}
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 4]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickCount={5}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke={fillColor}
              fill={fillColor}
              fillOpacity={0.25}
              strokeWidth={2}
              dot={{ r: 3, fill: fillColor, strokeWidth: 0 }}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Per-dimension risk breakdown legend */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {data.map((dim) => (
            <div
              key={dim.key}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Polarity indicator dot */}
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: RISK_COLORS[dim.risk] }}
                />
                <span className="truncate font-medium">{dim.dimension}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {dim.score.toFixed(2)}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 font-medium"
                  style={{
                    borderColor: RISK_COLORS[dim.risk],
                    color: RISK_COLORS[dim.risk],
                  }}
                >
                  {RISK_LABELS[dim.risk]}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Polarity note */}
        <p className="text-xs text-muted-foreground pt-1 border-t">
          Dimensões <strong>negativas</strong> (Demandas, Relacionamentos): pontuação alta = maior risco.
          Dimensões <strong>positivas</strong> (demais): pontuação baixa = maior risco.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────

const RISK_ORDER: RiskLevel[] = ['aceitavel', 'moderado', 'importante', 'critico'];

function getWorstRisk(levels: RiskLevel[]): RiskLevel {
  return levels.reduce(
    (worst, level) =>
      RISK_ORDER.indexOf(level) > RISK_ORDER.indexOf(worst) ? level : worst,
    'aceitavel' as RiskLevel
  );
}
