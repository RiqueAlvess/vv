'use client';

import { HSE_DIMENSIONS } from '@/lib/constants';

interface DimAnalysis { key: string; name: string; nr: number }

interface GroupData {
  gender?: string;
  age_range?: string;
  dimensions: Record<string, number>;
  total_responses: number;
}

interface DemographicTableProps {
  dimensionAnalysis: DimAnalysis[];
  genderRisk: GroupData[];
  ageRisk: GroupData[];
}

const PRIVACY_MIN = 5;

function deltaClass(delta: number) {
  if (delta < -0.5) return 'text-emerald-600 bg-emerald-50';
  if (delta > 0.5)  return 'text-red-600 bg-red-50';
  return 'text-muted-foreground';
}

export function DemographicTable({ dimensionAnalysis, genderRisk, ageRisk }: DemographicTableProps) {
  const overallByKey = Object.fromEntries(dimensionAnalysis.map((d) => [d.key, d.nr]));

  const groups = [
    ...genderRisk.map((g) => ({ label: g.gender ?? '?', data: g })),
    ...ageRisk.map((a) => ({ label: a.age_range ?? '?', data: a })),
  ];

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/40 min-w-[140px]">
              Dimensão
            </th>
            <th className="px-3 py-2 font-medium text-center min-w-[70px]">Geral</th>
            {groups.map((g) => (
              <th key={g.label} className="px-3 py-2 font-medium text-center min-w-[90px] whitespace-nowrap">
                <div>{g.label}</div>
                <div className="text-[10px] font-normal text-muted-foreground">n={g.data.total_responses}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HSE_DIMENSIONS.map((dim) => {
            const overall = overallByKey[dim.key] ?? 0;
            return (
              <tr key={dim.key} className="border-b hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 font-medium sticky left-0 bg-background">{dim.name}</td>
                <td className="px-3 py-2 text-center font-bold">{overall.toFixed(1)}</td>
                {groups.map((g) => {
                  if (g.data.total_responses < PRIVACY_MIN) {
                    return (
                      <td key={g.label} className="px-3 py-2 text-center text-muted-foreground/30">—</td>
                    );
                  }
                  const nr = g.data.dimensions[dim.key] ?? 0;
                  const delta = nr - overall;
                  return (
                    <td key={g.label} className="px-3 py-2 text-center">
                      <span className={`inline-block rounded px-1 py-0.5 font-medium ${deltaClass(delta)}`}>
                        {nr.toFixed(1)}
                      </span>
                      <div className="text-[10px] text-muted-foreground">
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
