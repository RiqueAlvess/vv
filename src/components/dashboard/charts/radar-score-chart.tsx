'use client';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DimData { key: string; name: string; nr: number; nr_color: string; nr_label: string; avg_score: number; }

export function RadarScoreChart({ dimensions }: { dimensions: unknown[] | null | undefined }) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return null;
  }

  const data = (dimensions as DimData[]).map(d => ({
    subject: d.name
      .replace('Comunicação e Mudanças', 'Com./Mudanças')
      .replace('Apoio da Chefia', 'Ap. Chefia')
      .replace('Apoio dos Colegas', 'Ap. Colegas')
      .replace('Cargo/Função', 'Cargo'),
    NR: d.nr,
    color: d.nr_color,
    fullName: d.name,
    score: d.avg_score,
    label: d.nr_label,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score de Clima Psicossocial</CardTitle>
        <CardDescription>Nível de Risco (NR) por dimensão — escala 1 a 16</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="#F4F4F4" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#333333' }} />
            <PolarRadiusAxis angle={90} domain={[0, 16]} tick={{ fontSize: 9 }} tickCount={5} />
            <Radar name="NR" dataKey="NR" stroke="#002B49" fill="#C5A059" fillOpacity={0.22} strokeWidth={2} />
            <Tooltip
              formatter={(val: unknown, _: unknown, props: { payload?: { score: number; label: string } }) => [
                `NR: ${val} (${props.payload?.label ?? ''}) | Score: ${props.payload?.score.toFixed(2) ?? ''}`,
                '',
              ] as [string, string]}
            />
          </RadarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {(dimensions as DimData[]).map(d => (
            <div key={d.key} className="flex items-center justify-between px-2 py-1 rounded border text-xs">
              <span className="truncate text-muted-foreground">{d.name}</span>
              <Badge className="text-white ml-2 shrink-0 text-[10px]" style={{ backgroundColor: d.nr_color }}>
                NR {d.nr}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
