'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HSE_QUESTIONS } from '@/lib/constants';

interface ChartRow {
  name: string;
  dim: string;
  question_number: number;
  'Aceitável': number;
  'Moderado': number;
  'Importante': number;
  'Crítico': number;
}

interface TooltipPayload {
  name: string;
  value: number;
  fill: string;
  payload: ChartRow;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const { dim, question_number } = payload[0].payload;
  const questionText = HSE_QUESTIONS[question_number];

  return (
    <div className="bg-white border rounded shadow-md p-2.5 text-xs max-w-[280px]">
      <p className="font-semibold mb-0.5">
        {label} — {dim}
      </p>
      {questionText && (
        <p className="italic text-muted-foreground mb-2 leading-snug">
          &ldquo;{questionText}&rdquo;
        </p>
      )}
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 shrink-0 rounded-sm" style={{ backgroundColor: p.fill }} />
              {p.name}
            </span>
            <span className="font-medium tabular-nums">{p.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StackedQuestionChart({ data }: { data: unknown[] }) {
  const chartData: ChartRow[] = (data as Array<{
    question_number: number; dimension: string;
    aceitavel_pct: number; moderado_pct: number; importante_pct: number; critico_pct: number;
  }>).map(d => ({
    name: `Q${d.question_number}`,
    dim: d.dimension,
    question_number: d.question_number,
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
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Aceitável"  stackId="a" fill="#009B00" />
                <Bar dataKey="Moderado"   stackId="a" fill="#F7B511" />
                <Bar dataKey="Importante" stackId="a" fill="#F75900" />
                <Bar dataKey="Crítico"    stackId="a" fill="#F60000" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#009B00] inline-block"/> Aceitável</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#F7B511] inline-block"/> Moderado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#F75900] inline-block"/> Importante</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#F60000] inline-block"/> Crítico</span>
        </div>
      </CardContent>
    </Card>
  );
}
