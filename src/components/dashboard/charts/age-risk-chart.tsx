'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface AgeData {
  age_range: string;
  total_responses: number;
  critical_pct: number;
  worst_dimension: string | null;
  worst_dimension_nr: number;
  suppressed: boolean;
}

const NR_COLOR = (pct: number) =>
  pct >= 50 ? '#ef4444' :
  pct >= 30 ? '#f97316' :
  pct >= 15 ? '#eab308' : '#22c55e';

interface TooltipPayload {
  payload: AgeData;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (d.suppressed) return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-medium">{d.age_range} anos</p>
      <p className="text-muted-foreground">Dados suprimidos (menos de 5 respondentes)</p>
    </div>
  );
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-sm">{d.age_range} anos</p>
      <p className="text-muted-foreground">{d.total_responses} respondentes</p>
      <p style={{ color: NR_COLOR(d.critical_pct) }}>
        {d.critical_pct}% em risco alto/critico
      </p>
      {d.worst_dimension && (
        <p className="text-muted-foreground">
          Dimensao mais critica:{' '}
          <span className="font-medium text-foreground">{d.worst_dimension}</span>
          {' '}(NR {d.worst_dimension_nr})
        </p>
      )}
    </div>
  );
}

export function AgeRiskChart({ data }: { data: AgeData[] }) {
  const hasVisibleData = data.some(d => !d.suppressed && d.total_responses > 0);
  if (!hasVisibleData) return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Risco por Faixa Etaria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum dado demografico disponivel. Os respondentes nao informaram faixa etaria,
          ou todos os grupos tem menos de 5 respondentes (protecao de anonimato).
        </p>
      </CardContent>
    </Card>
  );

  const visible = data.filter(d => d.age_range !== 'Nao informado' || d.total_responses > 0);
  const chartData = visible.map(d => ({
    ...d,
    label: d.age_range === 'Nao informado' ? 'N/I' : d.age_range,
    display_pct: d.suppressed ? 0 : d.critical_pct,
  }));

  const mostAtRisk = visible
    .filter(d => !d.suppressed)
    .sort((a, b) => b.critical_pct - a.critical_pct)[0];

  const mostResponders = visible
    .filter(d => !d.suppressed)
    .sort((a, b) => b.total_responses - a.total_responses)[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Risco por Faixa Etaria
        </CardTitle>
        <CardDescription>
          Distribuicao de risco alto/critico por faixa etaria dos respondentes
          {mostAtRisk && (
            <span className="block mt-1">
              Faixa mais exposta:{' '}
              <span className="font-medium text-foreground">{mostAtRisk.age_range} anos</span>
              {' '}— {mostAtRisk.critical_pct}% em risco alto
              {mostAtRisk.worst_dimension && (
                <span className="text-muted-foreground"> (dimensao: {mostAtRisk.worst_dimension})</span>
              )}
            </span>
          )}
          {mostResponders && (
            <span className="block text-muted-foreground">
              Maior participacao: {mostResponders.age_range} anos ({mostResponders.total_responses} respostas)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748b' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              unit="%"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="display_pct" radius={[5, 5, 0, 0]} maxBarSize={60}>
              <LabelList
                dataKey="display_pct"
                position="top"
                formatter={(v: unknown) => (v as number) > 0 ? `${v}%` : '—'}
                style={{ fontSize: 10, fontWeight: 600 }}
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

        {/* Summary table */}
        <div className="mt-3 rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Faixa</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Respostas</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Risco Alto</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Dimensao Critica</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    {d.age_range}{d.age_range !== 'Nao informado' ? ' anos' : ''}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {d.total_responses}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {d.suppressed ? (
                      <span className="text-muted-foreground text-[10px]">suprimido</span>
                    ) : (
                      <Badge
                        className="text-white text-[10px] px-1.5 py-0"
                        style={{ backgroundColor: NR_COLOR(d.critical_pct) }}
                      >
                        {d.critical_pct}%
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {d.suppressed ? '—' : (d.worst_dimension ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Grupos com menos de 5 respondentes sao suprimidos (LGPD). Baseado nos dados demograficos informados voluntariamente no inicio do questionario.
        </p>
      </CardContent>
    </Card>
  );
}
