'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HSE_DIMENSIONS } from '@/lib/constants';

interface HeatmapRow {
  unit: string;
  dimensions: Record<string, { nr: number; color: string; label: string }>;
}

export function HeatmapChart({ heatmap }: { heatmap: unknown[] }) {
  const rows = (Array.isArray(heatmap) ? heatmap : [])
    .filter((row): row is HeatmapRow => {
      if (!row || typeof row !== 'object') return false;
      const candidate = row as Partial<HeatmapRow>;
      return typeof candidate.unit === 'string' && !!candidate.dimensions && typeof candidate.dimensions === 'object';
    });

  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heatmap — NR por Dimensão × Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados de unidade disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const dimNames = HSE_DIMENSIONS.map(d => ({ key: d.key, name: d.name }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Heatmap — NR Médio por Dimensão e Unidade</CardTitle>
        <CardDescription>Identificação de pontos críticos organizacionais</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium text-muted-foreground min-w-[100px]">Dimensão</th>
                {rows.map(r => (
                  <th key={r.unit} className="text-center p-2 font-medium text-muted-foreground min-w-[80px]">
                    {r.unit}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dimNames.map(dim => (
                <tr key={dim.key} className="border-t border-border/30">
                  <td className="p-2 font-medium text-muted-foreground truncate max-w-[100px]" title={dim.name}>
                    {dim.name
                      .replace('Comunicação e Mudanças', 'Com./Mud.')
                      .replace('Apoio da Chefia', 'Ap. Chefia')
                      .replace('Apoio dos Colegas', 'Ap. Colegas')
                      .replace('Cargo/Função', 'Cargo')}
                  </td>
                  {rows.map(row => {
                    const cell = row.dimensions?.[dim.key];
                    if (!cell) return (
                      <td key={row.unit} className="p-1">
                        <div className="h-9 rounded bg-muted flex items-center justify-center text-muted-foreground">—</div>
                      </td>
                    );
                    const textColor = cell.nr >= 9 ? '#ffffff' : '#1e293b';
                    return (
                      <td key={row.unit} className="p-1">
                        <div
                          className="h-9 rounded flex items-center justify-center font-semibold transition-opacity hover:opacity-80 cursor-default"
                          style={{ backgroundColor: cell.color, color: textColor }}
                          title={`${dim.name} — ${row.unit}: NR ${cell.nr} (${cell.label})`}
                        >
                          {cell.nr}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
          <span className="font-medium">NR:</span>
          {[
            { label: '1–4 Aceitável',   color: '#22c55e' },
            { label: '5–8 Moderado',    color: '#eab308' },
            { label: '9–12 Importante', color: '#f97316' },
            { label: '13–16 Crítico',   color: '#ef4444' },
          ].map(item => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
