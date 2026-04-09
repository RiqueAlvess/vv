'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CriticalSectorRow {
  sector: string;
  /** Percentage of dimension×response combinations scoring at 'crítico' level */
  percentage: number;
  /** Pre-computed hex color from DashboardService */
  color: string;
}

interface CriticalSectorsTableProps {
  sectors: CriticalSectorRow[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getRiskLabel(percentage: number): string {
  if (percentage > 50) return 'Crítico';
  if (percentage > 25) return 'Importante';
  return 'Moderado';
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Ranked table of the top 5 sectors by psychosocial risk exposure.
 *
 * Each row shows:
 *   Rank  |  Sector name  |  Risk % bar  |  Risk badge
 *
 * "Risk %" = the fraction of (response × dimension) pairs that scored
 * at the 'crítico' level, computed by DashboardService.getTopCriticalSectors.
 * A sector with 60% means that 60% of its dimension readings across all
 * responses are in the critical zone — a strong indicator of systematic risk.
 *
 * Empty state: rendered when the analytics ETL hasn't produced sector data
 * yet (expected until the sector-mapping job is wired in analytics.actions.ts).
 */
export function CriticalSectorsTable({ sectors }: CriticalSectorsTableProps) {
  const top5 = sectors.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Top 5 Setores Críticos
        </CardTitle>
        <CardDescription>
          Setores com maior concentração de risco psicossocial por dimensão HSE-IT
        </CardDescription>
      </CardHeader>
      <CardContent>
        {top5.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1.5rem_1fr_140px_80px] gap-3 px-1 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
              <span>#</span>
              <span>Setor</span>
              <span>Índice de Risco</span>
              <span className="text-right">Nível</span>
            </div>

            {/* Rows */}
            {top5.map((row, idx) => (
              <div
                key={row.sector}
                className="grid grid-cols-[1.5rem_1fr_140px_80px] items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/50 transition-colors"
              >
                {/* Rank */}
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: idx === 0 ? '#F60000' : idx === 1 ? '#F75900' : 'hsl(var(--muted-foreground))' }}
                >
                  {idx + 1}
                </span>

                {/* Sector name */}
                <span
                  className="text-sm font-medium truncate"
                  title={row.sector}
                >
                  {row.sector}
                </span>

                {/* Risk % with progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-muted-foreground">{row.percentage.toFixed(1)}% crítico</span>
                  </div>
                  <Progress
                    value={row.percentage}
                    className="h-1.5"
                    // The progress fill colour is overridden via CSS variable
                    // injected as an inline style on the wrapper
                    style={{ '--progress-color': row.color } as React.CSSProperties}
                  />
                </div>

                {/* Risk badge */}
                <div className="flex justify-end">
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold"
                    style={{ borderColor: row.color, color: row.color }}
                  >
                    {getRiskLabel(row.percentage)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">
        Dados de setor não disponíveis
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
        A associação setor–resposta requer que os convites sejam enviados
        com metadados organizacionais vinculados.
      </p>
    </div>
  );
}
