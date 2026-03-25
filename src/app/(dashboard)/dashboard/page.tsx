'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { RISK_COLORS } from '@/lib/constants';
import type { Campaign, DashboardData, RiskLevel } from '@/types';
import { Activity, Users, TrendingUp, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const { get } = useApi();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await get('/api/campaigns?limit=100');
        const data = await res.json();
        const closed = (data.data || []).filter((c: Campaign) => c.status === 'closed');
        setCampaigns(closed);
        if (closed.length > 0) {
          setSelectedCampaign(closed[0].id);
        }
      } catch {
        setError('Erro ao carregar campanhas');
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, [get]);

  useEffect(() => {
    if (!selectedCampaign) return;
    const fetchDashboard = async () => {
      setDashLoading(true);
      setError('');
      try {
        const res = await get(`/api/campaigns/${selectedCampaign}/dashboard`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Erro ao carregar dashboard');
          setDashboardData(null);
          return;
        }
        const data = await res.json();
        setDashboardData(data);
      } catch {
        setError('Erro ao carregar dashboard');
      } finally {
        setDashLoading(false);
      }
    };
    fetchDashboard();
  }, [selectedCampaign, get]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Activity className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Nenhuma campanha encerrada</h2>
        <p className="text-muted-foreground mt-2">
          O dashboard estará disponível quando uma campanha for encerrada.
        </p>
      </div>
    );
  }

  const riskDistData = dashboardData ? Object.entries(dashboardData.risk_distribution).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: value as number,
    color: RISK_COLORS[key as RiskLevel],
  })) : [];

  const radarData = dashboardData?.radar_data?.map((item) => ({
    dimension: (item as { dimension: string }).dimension,
    score: (item as { score: number }).score,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos resultados da campanha</p>
        </div>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      {dashLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : dashboardData ? (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Convidados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.metrics.total_invited}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Respostas</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.metrics.total_responded}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.metrics.response_rate.toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">IGRP</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.metrics.igrp}</div>
                <Badge variant={dashboardData.metrics.igrp > 8 ? 'destructive' : 'secondary'} className="mt-1">
                  {dashboardData.metrics.igrp > 12 ? 'Crítico' : dashboardData.metrics.igrp > 8 ? 'Importante' : dashboardData.metrics.igrp > 4 ? 'Moderado' : 'Aceitável'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Radar Chart - Dimension Scores */}
            <Card>
              <CardHeader>
                <CardTitle>Dimensões HSE</CardTitle>
                <CardDescription>Pontuação média por dimensão</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 4]} />
                    <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Risco</CardTitle>
                <CardDescription>Classificação por nível de risco</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={riskDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                      {riskDistData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Dimension Scores Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Pontuação por Dimensão</CardTitle>
              <CardDescription>Média das respostas em cada dimensão HSE</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={radarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 4]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Critical Groups */}
          {dashboardData.top_critical_groups?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Grupos Demográficos Críticos</CardTitle>
                <CardDescription>Top 3 grupos com maior risco</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.top_critical_groups.map((group, i) => {
                    const g = group as { group: string; riskLevel: number; totalResponses: number; color: string };
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{g.group}</p>
                          <p className="text-sm text-muted-foreground">{g.totalResponses} respostas</p>
                        </div>
                        <Badge style={{ backgroundColor: g.color, color: '#fff' }}>{g.riskLevel}% crítico</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
