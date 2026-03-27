'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function WorkersRiskDonut({ highRiskPct, criticalPct, totalResponded }: {
  highRiskPct: number; criticalPct: number; totalResponded: number;
}) {
  const importantPct = Math.max(0, highRiskPct - criticalPct);
  const lowPct = Math.max(0, 100 - highRiskPct);

  const data = [
    { name: 'Aceitável/Moderado', value: lowPct, color: '#22c55e' },
    { name: 'Importante (NR 9–12)', value: importantPct, color: '#f97316' },
    { name: 'Crítico (NR 13–16)', value: criticalPct, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">% Trabalhadores em Risco</CardTitle>
        <CardDescription>
          Respondentes com NR ≥ 9 (Importante ou Crítico) em ao menos uma dimensão
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(val: number) => [`${val}%`, '']} />
            <Legend iconType="circle" iconSize={10} formatter={(value) => <span className="text-xs">{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
        <p className="text-center text-xs text-muted-foreground">
          Base: {totalResponded} respondentes
        </p>
      </CardContent>
    </Card>
  );
}
