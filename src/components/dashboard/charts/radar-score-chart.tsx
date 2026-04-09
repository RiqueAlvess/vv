'use client';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DimData { key: string; name: string; nr: number; nr_color: string; nr_label: string; avg_score: number; }

interface ChartRow {
  subject: string;
  NR: number;
  color: string;
  fullName: string;
  score: number;
  label: string;
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
  const { fullName, NR, color, label, score } = payload[0].payload;

  return (
    <div className="bg-white border rounded shadow-md p-2.5 text-xs max-w-[200px]">
      <p className="font-semibold mb-1">{fullName}</p>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        <span>{label}</span>
      </div>
      <p className="text-muted-foreground">
        NR: <span className="text-foreground font-medium">{NR}</span>
        <span className="text-muted-foreground"> /16</span>
      </p>
      <p className="text-muted-foreground">
        Score médio: <span className="text-foreground font-medium">{score.toFixed(2)}</span>
        <span className="text-muted-foreground"> /4</span>
      </p>
    </div>
  );
}

export function RadarScoreChart({ dimensions }: { dimensions: unknown[] | null | undefined }) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return null;
  }

  const data: ChartRow[] = (dimensions as DimData[]).map(d => ({
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
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6B7280' }} />
            <PolarRadiusAxis angle={90} domain={[0, 16]} tick={{ fontSize: 9 }} tickCount={5} />
            <Radar name="NR" dataKey="NR" stroke="#1AA278" fill="#1AA278" fillOpacity={0.22} strokeWidth={2} />
            <Tooltip content={<CustomTooltip />} />
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
