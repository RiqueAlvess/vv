'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface AgeData {
  age_range: string;
  total_responses: number;
  critical_pct: number;
  high_risk_eval_pct?: number;
  worst_dimension: string | null;
  worst_dimension_nr: number;
  suppressed: boolean;
  dimensions: Record<string, number>;
}

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
  payload: AgeData & { igrp: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-sm">{d.age_range}{d.age_range !== 'Não informado' ? ' anos' : ''}</p>
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

export function AgeRiskChart({ data }: { data: unknown[] | null | undefined }) {
  const rawData = (Array.isArray(data) ? data : []) as AgeData[];
  if (rawData.length === 0) return null;

  const visible = rawData.filter(d => d.age_range !== 'Não informado' || d.total_responses > 0);

  const chartData = visible.map(d => ({
    ...d,
    label: d.age_range === 'Não informado' ? 'N/I' : d.age_range,
    igrp: igrpFromDimensions(d.dimensions ?? {}),
    display_pct: igrpFromDimensions(d.dimensions ?? {}),
  }));

  const mostAtRisk = [...chartData].sort((a, b) => b.igrp - a.igrp)[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Risco por Faixa Etária
        </CardTitle>
        <CardDescription>
          IGRP médio por grupo (Nível de Risco, escala 1–16)
          {mostAtRisk && mostAtRisk.total_responses > 0 && (
            <span className="block mt-1">
              Maior exposição:{' '}
              <span className="font-medium text-foreground">
                {mostAtRisk.age_range}{mostAtRisk.age_range !== 'Não informado' ? ' anos' : ''}
              </span>
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
              dataKey="label"
              tick={{ fontSize: 10, fill: '#6B7280' }}
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
            <Bar dataKey="display_pct" radius={[6, 6, 0, 0]} maxBarSize={60}>
              <LabelList
                dataKey="display_pct"
                position="top"
                formatter={(v: unknown) => (typeof v === 'number' && v > 0) ? v.toFixed(1) : '—'}
                style={{ fontSize: 10, fontWeight: 600 }}
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

        {/* Summary table */}
        <div className="mt-3 rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Faixa</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Respostas</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">IGRP</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Dimensão Crítica</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    {d.age_range}{d.age_range !== 'Não informado' ? ' anos' : ''}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {d.total_responses}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge
                      className="text-[10px] px-1.5 py-0"
                      style={{ backgroundColor: igrpColor(d.igrp), color: '#ffffff' }}
                    >
                      {d.igrp.toFixed(1)} — {igrpLabel(d.igrp)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {d.worst_dimension ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
