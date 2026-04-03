'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface GenderData {
  gender: string;
  total_responses: number;
  critical_pct: number;
  worst_dimension: string | null;
  worst_dimension_nr: number;
  suppressed: boolean;
}

const GENDER_COLORS: Record<string, string> = {
  'Masculino':     '#0D3D4F',
  'Feminino':      '#00C896',
  'Outro':         '#1B5F75',
  'Nao informado': '#94a3b8',
};

const NR_COLOR = (pct: number) =>
  pct >= 50 ? '#FF0000' :
  pct >= 30 ? '#F79454' :
  pct >= 15 ? '#FFFF00' : '#A2C06A';

const NR_TEXT_COLOR = (pct: number) =>
  pct >= 15 ? '#ffffff' : '#000000';

interface TooltipPayload {
  payload: GenderData;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-sm">{d.gender}</p>
      <p className="text-muted-foreground">{d.total_responses} respondentes</p>
      <p style={{ color: NR_COLOR(d.critical_pct) }}>
        {d.critical_pct}% em risco alto/critico
      </p>
      {d.worst_dimension && (
        <p className="text-muted-foreground">
          Dimensao critica: <span className="font-medium text-foreground">{d.worst_dimension}</span>
          {' '}(NR {d.worst_dimension_nr})
        </p>
      )}
    </div>
  );
}

export function GenderRiskChart({ data }: { data: GenderData[] | null | undefined }) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const chartData = data.map(d => ({
    ...d,
    display_pct: d.critical_pct,
  }));

  const mostAtRisk = data.sort((a, b) => b.critical_pct - a.critical_pct)[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Risco por Genero
        </CardTitle>
        <CardDescription>
          % de avaliacoes em risco alto ou critico (NR maior ou igual a 9) por genero
          {mostAtRisk && mostAtRisk.total_responses > 0 && (
            <span className="block mt-1">
              Maior exposicao:{' '}
              <span className="font-medium text-foreground">{mostAtRisk.gender}</span>
              {' '}— {mostAtRisk.critical_pct}% em risco alto
              {mostAtRisk.worst_dimension && (
                <span className="text-muted-foreground"> (dimensao: {mostAtRisk.worst_dimension})</span>
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
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#6B7280' }}
              unit="%"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="display_pct" radius={[6, 6, 0, 0]} maxBarSize={72}>
              <LabelList
                dataKey="display_pct"
                position="top"
                formatter={(v: unknown) => (typeof v === 'number' && v > 0) ? `${v}%` : '—'}
                style={{ fontSize: 11, fontWeight: 600 }}
              />
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={NR_COLOR(entry.critical_pct)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend / detail cards */}
        <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-4">
          {data.map(d => (
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
                style={{ backgroundColor: NR_COLOR(d.critical_pct), color: NR_TEXT_COLOR(d.critical_pct) }}
              >
                {d.critical_pct}% alto risco
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
