'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function StackedQuestionChart({ data }: { data: unknown[] }) {
  const chartData = (data as Array<{
    question_number: number; dimension: string;
    aceitavel_pct: number; moderado_pct: number; importante_pct: number; critico_pct: number;
  }>).map(d => ({
    name: `Q${d.question_number}`,
    dim: d.dimension,
    'Aceitável': d.aceitavel_pct,
    'Moderado': d.moderado_pct,
    'Importante': d.importante_pct,
    'Crítico': d.critico_pct,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuição de Risco por Questão</CardTitle>
        <CardDescription>
          % de respondentes por nível de risco em cada uma das 35 questões HSE-IT (polaridade considerada)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 700 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#6B7280' }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(val: unknown) => `${val}%`}
                  labelFormatter={(label, payload) =>
                    payload?.[0] ? `${label} — ${(payload[0].payload as { dim: string }).dim}` : label
                  }
                />
                <Bar dataKey="Aceitável"  stackId="a" fill="#A2C06A" />
                <Bar dataKey="Moderado"   stackId="a" fill="#FFFF00" />
                <Bar dataKey="Importante" stackId="a" fill="#F79454" />
                <Bar dataKey="Crítico"    stackId="a" fill="#FF0000" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#A2C06A] inline-block"/> Aceitável</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#FFFF00] inline-block border border-gray-200"/> Moderado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#F79454] inline-block"/> Importante</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#FF0000] inline-block"/> Crítico</span>
        </div>
      </CardContent>
    </Card>
  );
}
