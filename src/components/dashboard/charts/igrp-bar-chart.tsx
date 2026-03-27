'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface DimensionData {
  key: string; name: string; nr: number; nr_color: string; nr_label: string; avg_score: number;
}

export function IgrpBarChart({ dimensions }: { dimensions: unknown[] }) {
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis domain={[0, 16]} tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip
              formatter={(val: number, _: string, props: { payload: { label: string; score: number } }) => [
                `NR: ${val} (${props.payload.label}) | Score: ${props.payload.score.toFixed(2)}`,
                'Risco',
              ]}
            />
            <ReferenceLine y={4}  stroke="#22c55e" strokeDasharray="4 2" label={{ value: 'Aceitável',  position: 'right', fontSize: 9, fill: '#22c55e' }} />
            <ReferenceLine y={8}  stroke="#eab308" strokeDasharray="4 2" label={{ value: 'Moderado',   position: 'right', fontSize: 9, fill: '#eab308' }} />
            <ReferenceLine y={12} stroke="#f97316" strokeDasharray="4 2" label={{ value: 'Importante', position: 'right', fontSize: 9, fill: '#f97316' }} />
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
