'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface PositionRow {
  position: string; sector: string; unit: string;
  score_pct: number; classification: string; nr: number; n_responses: number;
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Aceitável':  { bg: '#A2C06A', text: '#000000' },
  'Moderado':   { bg: '#FFFF00', text: '#000000' },
  'Importante': { bg: '#F79454', text: '#ffffff' },
  'Crítico':    { bg: '#FF0000', text: '#ffffff' },
};

export function PositionTable({ positions }: { positions: unknown[] }) {
  const rows = positions as PositionRow[];
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
      <CardHeader>
        <CardTitle className="text-base">Análise Detalhada por Cargo</CardTitle>
        <CardDescription>Score médio e classificação predominante por cargo/função</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Score (%)</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead className="text-center">NR</TableHead>
              <TableHead className="text-center">N Respostas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{row.position}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.sector}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.unit}</TableCell>
                <TableCell className="text-center tabular-nums">{row.score_pct.toFixed(1)}</TableCell>
                <TableCell>
                  <Badge className="text-xs" style={{ backgroundColor: BADGE_COLORS[row.classification]?.bg ?? '#94a3b8', color: BADGE_COLORS[row.classification]?.text ?? '#ffffff' }}>
                    {row.classification}
                  </Badge>
                </TableCell>
                <TableCell className="text-center tabular-nums font-mono">{row.nr.toFixed(1)}</TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">{row.n_responses}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum cargo encontrado nesta campanha
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {rows.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} de {rows.length} cargos
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
      </CardContent>
    </Card>
  );
}
