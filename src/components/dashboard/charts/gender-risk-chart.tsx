'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface GenderData {
  gender: string;
  total_responses: number;
  critical_pct: number;
  high_risk_eval_pct?: number;
  worst_dimension: string | null;
  worst_dimension_nr: number;
  suppressed: boolean;
  dimensions: Record<string, number>;
}

const GENDER_COLORS: Record<string, string> = {
  'Masculino':     '#0D3D4F',
  'Feminino':      '#1AA278',
  'Outro':         '#1B5F75',
  'Nao informado': '#94a3b8',
};

function igrpFromDimensions(dimensions: Record<string, number>): number {
  const vals = Object.values(dimensions);
  if (vals.length === 0) return 0;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}

function igrpColor(igrp: number): string {
  if (igrp > 12) return '#F60000';
  if (igrp > 8)  return '#F75900';
  if (igrp > 4)  return '#F7B511';
  return '#009B00';
}

function igrpLabel(igrp: number): string {
  if (igrp > 12) return 'Crítico';
  if (igrp > 8)  return 'Importante';
  if (igrp > 4)  return 'Moderado';
  return 'Aceitável';
}

interface TooltipPayload {
  payload: GenderData & { igrp: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-sm">{d.gender}</p>
      <p className="text-muted-foreground">{d.total_responses} respondentes</p>
      <p style={{ color: igrpColor(d.igrp) }}>
        IGRP {d.igrp.toFixed(1)} — {igrpLabel(d.igrp)}
      </p>
      {d.worst_dimension && (
        <p className="text-muted-foreground">
          Dimensão de maior risco: <span className="font-medium text-foreground">{d.worst_dimension}</span>
          {' '}(NR médio {d.worst_dimension_nr})
        </p>
      )}
    </div>
  );
}

export function GenderRiskChart({ data }: { data: unknown[] | null | undefined }) {
  const rawData = (Array.isArray(data) ? data : []) as GenderData[];
  if (rawData.length === 0) return null;

  const chartData = rawData.map(d => ({
    ...d,
    igrp: igrpFromDimensions(d.dimensions ?? {}),
    display_pct: igrpFromDimensions(d.dimensions ?? {}),
  }));

  const mostAtRisk = [...chartData].sort((a, b) => b.igrp - a.igrp)[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Risco por Gênero
        </CardTitle>
        <CardDescription>
          IGRP médio por grupo (Nível de Risco, escala 1–16)
          {mostAtRisk && mostAtRisk.total_responses > 0 && (
            <span className="block mt-1">
              Maior exposição:{' '}
              <span className="font-medium text-foreground">{mostAtRisk.gender}</span>
              {' '}— IGRP {mostAtRisk.igrp.toFixed(1)} ({igrpLabel(mostAtRisk.igrp)})
              {mostAtRisk.worst_dimension && (
                <span className="text-muted-foreground"> · dimensão: {mostAtRisk.worst_dimension}</span>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="gender"
              tick={{ fontSize: 11, fill: '#6B7280' }}
            />
            <YAxis
              domain={[0, 16]}
              ticks={[0, 4, 8, 12, 16]}
              tick={{ fontSize: 10, fill: '#6B7280' }}
            />
            <ReferenceLine y={4}  stroke="#009B00" strokeDasharray="4 3" label={{ value: 'Aceitável', position: 'insideRight', fontSize: 9, fill: '#009B00' }} />
            <ReferenceLine y={8}  stroke="#F7B511" strokeDasharray="4 3" label={{ value: 'Moderado',  position: 'insideRight', fontSize: 9, fill: '#F7B511' }} />
            <ReferenceLine y={12} stroke="#F75900" strokeDasharray="4 3" label={{ value: 'Importante', position: 'insideRight', fontSize: 9, fill: '#F75900' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="display_pct" radius={[6, 6, 0, 0]} maxBarSize={72}>
              <LabelList
                dataKey="display_pct"
                position="top"
                formatter={(v: unknown) => (typeof v === 'number' && v > 0) ? v.toFixed(1) : '—'}
                style={{ fontSize: 11, fontWeight: 600 }}
              />
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={igrpColor(entry.igrp)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend / detail cards */}
        <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-4">
          {chartData.map(d => (
            <div
              key={d.gender}
              className="rounded-lg border p-2 text-xs space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: GENDER_COLORS[d.gender] ?? '#94a3b8' }}
                />
                <span className="font-medium truncate">{d.gender}</span>
              </div>
              <p className="text-muted-foreground">{d.total_responses} respostas</p>
              <Badge
                className="text-[10px] px-1.5 py-0"
                style={{ backgroundColor: igrpColor(d.igrp), color: '#ffffff' }}
              >
                IGRP {d.igrp.toFixed(1)} — {igrpLabel(d.igrp)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
