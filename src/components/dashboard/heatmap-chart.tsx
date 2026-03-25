'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RISK_COLORS } from '@/lib/constants';
import type { RiskLevel } from '@/types';

interface HeatmapCell {
  score: number;
  riskLevel: RiskLevel;
}

interface HeatmapRow {
  sector: string;
  dimensions: Record<string, HeatmapCell>;
}

interface HeatmapChartProps {
  data: HeatmapRow[];
  dimensions: { key: string; name: string }[];
}

function getRiskBg(riskLevel: RiskLevel): string {
  return RISK_COLORS[riskLevel] || '#94a3b8';
}

function getTextColor(riskLevel: RiskLevel): string {
  return riskLevel === 'moderado' ? '#1e293b' : '#ffffff';
}

export function HeatmapChart({ data, dimensions }: HeatmapChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mapa de Calor — Setor × Dimensão</CardTitle>
          <CardDescription>Dados insuficientes para gerar o mapa de calor</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa de Calor — Setor × Dimensão</CardTitle>
        <CardDescription>Pontuação por setor em cada dimensão HSE (Top 10 setores de maior risco)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={200}>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground min-w-[140px]">Setor</th>
                  {dimensions.map((dim) => (
                    <th key={dim.key} className="text-center p-2 font-medium text-muted-foreground min-w-[90px]">
                      {dim.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-t border-border/50">
                    <td className="p-2 font-medium truncate max-w-[160px]" title={row.sector}>
                      {row.sector}
                    </td>
                    {dimensions.map((dim) => {
                      const cell = row.dimensions[dim.key];
                      if (!cell) {
                        return (
                          <td key={dim.key} className="p-1">
                            <div className="h-9 rounded flex items-center justify-center bg-muted text-muted-foreground">
                              —
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={dim.key} className="p-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="h-9 rounded flex items-center justify-center font-semibold cursor-default transition-opacity hover:opacity-80"
                                style={{
                                  backgroundColor: getRiskBg(cell.riskLevel),
                                  color: getTextColor(cell.riskLevel),
                                }}
                              >
                                {cell.score.toFixed(1)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="font-medium">{row.sector} — {dim.name}</p>
                              <p>Score: {cell.score.toFixed(2)} | Risco: {cell.riskLevel}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <span className="font-medium">Legenda:</span>
          {(['aceitavel', 'moderado', 'importante', 'critico'] as RiskLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: RISK_COLORS[level] }}
              />
              <span className="capitalize">{level === 'aceitavel' ? 'Aceitável' : level === 'critico' ? 'Crítico' : level}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
