'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PositionRow {
  position: string; sector: string; unit: string;
  score_pct: number; classification: string; nr: number; n_responses: number;
}

const BADGE_COLORS: Record<string, string> = {
  'Aceitável':  '#22c55e',
  'Moderado':   '#eab308',
  'Importante': '#f97316',
  'Crítico':    '#ef4444',
};

export function PositionTable({ positions }: { positions: unknown[] }) {
  const rows = positions as PositionRow[];

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
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{row.position}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.sector}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.unit}</TableCell>
                <TableCell className="text-center tabular-nums">{row.score_pct.toFixed(1)}</TableCell>
                <TableCell>
                  <Badge className="text-white text-xs" style={{ backgroundColor: BADGE_COLORS[row.classification] ?? '#94a3b8' }}>
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
      </CardContent>
    </Card>
  );
}
