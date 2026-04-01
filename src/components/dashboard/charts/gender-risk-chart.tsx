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
  'Masculino':     '#3b82f6',
  'Feminino':      '#ec4899',
  'Outro':         '#8b5cf6',
  'Nao informado': '#94a3b8',
};

const NR_COLOR = (pct: number) =>
  pct >= 50 ? '#ef4444' :
  pct >= 30 ? '#f97316' :
  pct >= 15 ? '#eab308' : '#22c55e';

interface TooltipPayload {
  payload: GenderData;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (d.suppressed) return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-medium">{d.gender}</p>
      <p className="text-muted-foreground">Dados suprimidos (menos de 5 respondentes)</p>
    </div>
  );
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
  const hasVisibleData = data.some(d => !d.suppressed && d.total_responses > 0);
  if (!hasVisibleData) return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Risco por Genero
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum dado demografico disponivel. Os respondentes nao informaram genero,
          ou todos os grupos tem menos de 5 respondentes (protecao de anonimato).
        </p>
      </CardContent>
    </Card>
  );

  const chartData = data.map(d => ({
    ...d,
    display_pct: d.suppressed ? 0 : d.critical_pct,
  }));

  const mostAtRisk = data.filter(d => !d.suppressed).sort((a, b) => b.critical_pct - a.critical_pct)[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Risco por Genero
        </CardTitle>
        <CardDescription>
          % de avaliacoes em risco alto ou critico (NR maior ou igual a 9) por genero
          {mostAtRisk && !mostAtRisk.suppressed && (
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="gender"
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#64748b' }}
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
                  fill={entry.suppressed ? '#e2e8f0' : NR_COLOR(entry.critical_pct)}
                  opacity={entry.suppressed ? 0.5 : 1}
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
              className={`rounded-lg border p-2 text-xs space-y-1 ${
                d.suppressed ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: GENDER_COLORS[d.gender] ?? '#94a3b8' }}
                />
                <span className="font-medium truncate">{d.gender}</span>
              </div>
              {d.suppressed ? (
                <p className="text-muted-foreground">Suprimido (&lt;5)</p>
              ) : (
                <>
                  <p className="text-muted-foreground">{d.total_responses} respostas</p>
                  <Badge
                    className="text-white text-[10px] px-1.5 py-0"
                    style={{ backgroundColor: NR_COLOR(d.critical_pct) }}
                  >
                    {d.critical_pct}% alto risco
                  </Badge>
                </>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3 border-t pt-2">
          Grupos com menos de 5 respondentes sao suprimidos (protecao de anonimato LGPD).
        </p>
      </CardContent>
    </Card>
  );
}
