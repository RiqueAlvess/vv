'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AdmStats {
  companies: {
    total: number;
    active: number;
    withUsers: number;
  };
  users: {
    total: number;
    rh: number;
    lider: number;
    activeToday: number;
    activeLast7Days: number;
    activeLast30Days: number;
  };
  accessTimeSeries: Array<{
    date: string;
    rh: number;
    lider: number;
    total: number;
  }>;
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value.toLocaleString('pt-BR')}</p>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

async function fetchStats(): Promise<AdmStats> {
  const res = await fetch('/api/adm/stats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export default function AdmDashboardPage() {
  const { data, isLoading, isError } = useQuery<AdmStats>({
    queryKey: ['adm-stats'],
    queryFn: fetchStats,
    staleTime: 60_000,
  });

  const statCards = [
    { title: 'Total de Empresas', value: data?.companies.total },
    { title: 'Empresas Ativas', value: data?.companies.active },
    { title: 'Usuários RH', value: data?.users.rh },
    { title: 'Usuários Liderança', value: data?.users.lider },
    { title: 'Acessos Hoje', value: data?.users.activeToday },
    { title: 'Acessos Últimos 7 Dias', value: data?.users.activeLast7Days },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Visão geral do sistema</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value ?? 0} />
            ))}
      </div>

      {/* Access Time Series Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Acessos nos Últimos 30 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : isError ? (
            <p className="text-sm text-destructive">Erro ao carregar dados do gráfico.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={data?.accessTimeSeries}
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 11 }}
                  minTickGap={14}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'rh' ? 'RH' : 'Liderança',
                  ]}
                  labelFormatter={(label: string) => `Data: ${label}`}
                />
                <Legend
                  formatter={(value: string) => (value === 'rh' ? 'RH' : 'Liderança')}
                />
                <Line
                  type="monotone"
                  dataKey="rh"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="lider"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
