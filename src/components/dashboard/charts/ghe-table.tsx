'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ShieldAlert } from 'lucide-react';

interface SectorRow {
  sector: string;
  unit: string;
  avg_hse_score: number;
  classification: string;
  nr: number;
  n_responses: number;
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Risco Baixo':    { bg: '#8ba800', text: '#ffffff' },
  'Risco Médio':    { bg: '#d4b000', text: '#ffffff' },
  'Risco Moderado': { bg: '#cc7722', text: '#ffffff' },
  'Risco Alto':     { bg: '#cc0000', text: '#ffffff' },
};

export function GheTable({
  sectors,
  onExportPGR,
  onExportXlsx,
  downloading,
  showRespondentCount = false,
}: {
  sectors: unknown[];
  onExportPGR?: () => void;
  onExportXlsx?: () => void;
  downloading?: boolean;
  showRespondentCount?: boolean;
}) {
  const rows = sectors as SectorRow[];
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Análise por GHE (Setor)</CardTitle>
          <CardDescription>Score HSE-IT (0–4) e NR por Grupo Homogêneo de Exposição</CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          {onExportXlsx && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportXlsx}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar Planilha
            </Button>
          )}
          {onExportPGR && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPGR}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? 'Gerando PGR...' : 'Exportar Relatório PGR'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Nenhum setor com respostas suficientes (mín. 5) para exibir dados.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GHE / Setor</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Score HSE-IT</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead className="text-center">NR</TableHead>
                  {showRespondentCount && <TableHead className="text-center">N Respostas</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.sector}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.unit}</TableCell>
                    <TableCell className="text-center tabular-nums">{(row.avg_hse_score ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: BADGE_COLORS[row.classification]?.bg ?? '#94a3b8',
                          color: BADGE_COLORS[row.classification]?.text ?? '#ffffff',
                        }}
                      >
                        {row.classification}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center tabular-nums font-mono">{(row.nr ?? 0).toFixed(1)}</TableCell>
                    {showRespondentCount && (
                      <TableCell className="text-center tabular-nums text-muted-foreground">{row.n_responses}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <p className="text-muted-foreground">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} de {rows.length} setores
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-muted-foreground">
                    Página {safePage} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
