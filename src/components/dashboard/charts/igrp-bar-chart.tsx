'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface DimensionData {
  key: string; name: string; nr: number; nr_color: string; nr_label: string; avg_score: number;
}

interface IgrpBarChartProps {
  dimensions: unknown[] | null | undefined;
}

interface ChartRow {
  name: string;
  fullName: string;
  nr: number;
  color: string;
  label: string;
  score: number;
}

interface TooltipPayload {
  payload: ChartRow;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const { fullName, nr, color, label, score } = payload[0].payload;

  return (
    <div className="bg-white border rounded shadow-md p-2.5 text-xs max-w-[200px]">
      <p className="font-semibold mb-1">{fullName}</p>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        <span>{label}</span>
      </div>
      <p className="text-muted-foreground">
        NR: <span className="text-foreground font-medium">{nr}</span>
        <span className="text-muted-foreground"> /16</span>
      </p>
      <p className="text-muted-foreground">
        Score médio: <span className="text-foreground font-medium">{score.toFixed(2)}</span>
        <span className="text-muted-foreground"> /4</span>
      </p>
    </div>
  );
}

export function IgrpBarChart({ dimensions }: IgrpBarChartProps) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return null;
  }

  const data: ChartRow[] = (dimensions as DimensionData[]).map(d => ({
    name: d.name
      .replace('Comunicação e Mudanças', 'Com. e Mudanças')
      .replace('Apoio da Chefia', 'Ap. Chefia')
      .replace('Apoio dos Colegas', 'Ap. Colegas')
      .replace('Cargo/Função', 'Cargo'),
    fullName: d.name,
    nr: d.nr,
    color: d.nr_color,
    label: d.nr_label,
    score: d.avg_score,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">IGRP por Dimensão</CardTitle>
        <CardDescription>Nível de Risco (NR = P × S) por dimensão HSE-IT. Escala 1–16.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 32, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis domain={[0, 16]} tick={{ fontSize: 10, fill: '#6B7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={4}  stroke="#A2C06A" strokeDasharray="4 2" label={{ value: 'Aceitável',  position: 'right', fontSize: 9, fill: '#A2C06A' }} />
            <ReferenceLine y={8}  stroke="#FFFF00" strokeDasharray="4 2" label={{ value: 'Moderado',   position: 'right', fontSize: 9, fill: '#888800' }} />
            <ReferenceLine y={12} stroke="#F79454" strokeDasharray="4 2" label={{ value: 'Importante', position: 'right', fontSize: 9, fill: '#F79454' }} />
            <Bar dataKey="nr" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
