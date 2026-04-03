'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function StackedDimensionChart({ data }: { data: unknown[] }) {
  const chartData = (data as Array<{
    dimension: string; aceitavel_pct: number; moderado_pct: number;
    importante_pct: number; critico_pct: number;
  }>).map(d => ({
    name: d.dimension
      .replace('Comunicação e Mudanças', 'Com. Mudanças')
      .replace('Apoio da Chefia', 'Ap. Chefia')
      .replace('Apoio dos Colegas', 'Ap. Colegas')
      .replace('Cargo/Função', 'Cargo'),
    'Aceitável': d.aceitavel_pct,
    'Moderado': d.moderado_pct,
    'Importante': d.importante_pct,
    'Crítico': d.critico_pct,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuição de Risco por Dimensão</CardTitle>
        <CardDescription>% de respondentes por nível de risco em cada dimensão HSE-IT</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} width={80} />
            <Tooltip formatter={(val: unknown) => `${val}%`} />
            <Legend iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
            <Bar dataKey="Aceitável"  stackId="a" fill="#A2C06A" />
            <Bar dataKey="Moderado"   stackId="a" fill="#FFFF00" />
            <Bar dataKey="Importante" stackId="a" fill="#F79454" />
            <Bar dataKey="Crítico"    stackId="a" fill="#FF0000" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
