'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface DimensionData {
  key: string; name: string; nr: number; nr_color: string; nr_label: string; avg_score: number;
}

interface IgrpBarChartProps {
  dimensions: unknown[] | null | undefined;
}

export function IgrpBarChart({ dimensions }: IgrpBarChartProps) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return null;
  }

  const data = (dimensions as DimensionData[]).map(d => ({
    name: d.name
      .replace('Comunicação e Mudanças', 'Com. e Mudanças')
      .replace('Apoio da Chefia', 'Ap. Chefia')
      .replace('Apoio dos Colegas', 'Ap. Colegas')
      .replace('Cargo/Função', 'Cargo'),
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F4F4F4" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#333333' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis domain={[0, 16]} tick={{ fontSize: 10, fill: '#333333' }} />
            <Tooltip
              formatter={(val: unknown, _: unknown, props: { payload?: { label: string; score: number } }) => [
                `NR: ${val} (${props.payload?.label ?? ''}) | Score: ${props.payload?.score.toFixed(2) ?? ''}`,
                'Risco',
              ] as [string, string]}
            />
            <ReferenceLine y={4}  stroke="#D4AF37" strokeDasharray="4 2" label={{ value: 'Aceitável',  position: 'right', fontSize: 9, fill: '#D4AF37' }} />
            <ReferenceLine y={8}  stroke="#C5A059" strokeDasharray="4 2" label={{ value: 'Moderado',   position: 'right', fontSize: 9, fill: '#C5A059' }} />
            <ReferenceLine y={12} stroke="#002B49" strokeDasharray="4 2" label={{ value: 'Importante', position: 'right', fontSize: 9, fill: '#002B49' }} />
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
