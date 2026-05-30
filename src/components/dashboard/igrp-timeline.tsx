'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimelinePoint {
  campaign_id: string;
  campaign_name: string;
  end_date: string;
  campaign_type: string;
  igrp: number;
}

interface IgrpTimelineProps {
  points: TimelinePoint[];
  onCampaignClick?: (campaignId: string) => void;
}

interface ChartEntry extends TimelinePoint {
  label: string;
  full: number | null;
  pulse: number | null;
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartEntry;
  onCampaignClick?: (id: string) => void;
}) {
  const { cx, cy, payload, onCampaignClick } = props;
  if (!cx || !cy || !payload) return null;
  const isPulse = payload.campaign_type === 'pulse';
  return (
    <circle
      cx={cx} cy={cy} r={5}
      fill={isPulse ? '#8B5CF6' : '#3B82F6'}
      stroke="white" strokeWidth={2}
      style={{ cursor: onCampaignClick ? 'pointer' : 'default' }}
      onClick={() => onCampaignClick?.(payload.campaign_id)}
    />
  );
}

export function IgrpTimeline({ points, onCampaignClick }: IgrpTimelineProps) {
  if (points.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Evolução do IGRP
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-24 text-sm text-muted-foreground">
          {points.length === 0
            ? 'Nenhuma campanha encerrada com métricas calculadas'
            : 'São necessárias pelo menos 2 campanhas para exibir a linha do tempo'}
        </CardContent>
      </Card>
    );
  }

  const chartData: ChartEntry[] = points.map((p) => ({
    ...p,
    label: format(new Date(p.end_date), 'dd/MM/yy', { locale: ptBR }),
    full: p.campaign_type !== 'pulse' ? p.igrp : null,
    pulse: p.campaign_type === 'pulse' ? p.igrp : null,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Evolução do IGRP
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              domain={[0, 16]}
              tick={{ fontSize: 11 }}
              label={{ value: 'NR', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ChartEntry;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow text-xs">
                    <p className="font-medium">{p.campaign_name}</p>
                    <p className="text-muted-foreground">{p.label}</p>
                    <p>IGRP: <span className="font-bold">{p.igrp.toFixed(2)}</span></p>
                    <p className="text-muted-foreground capitalize">
                      {p.campaign_type === 'pulse' ? 'Pulse' : 'Completa'}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={4}  stroke="#F7B511" strokeDasharray="4 4" label={{ value: 'Risco Médio',    fontSize: 9, fill: '#F7B511' }} />
            <ReferenceLine y={6}  stroke="#F75900" strokeDasharray="4 4" label={{ value: 'Risco Moderado', fontSize: 9, fill: '#F75900' }} />
            <Line
              type="monotone" dataKey="full" name="Completa"
              stroke="#3B82F6" connectNulls={false}
              dot={(props) => <CustomDot {...props} onCampaignClick={onCampaignClick} />}
              activeDot={false}
            />
            <Line
              type="monotone" dataKey="pulse" name="Pulse"
              stroke="#8B5CF6" connectNulls={false}
              dot={(props) => <CustomDot {...props} onCampaignClick={onCampaignClick} />}
              activeDot={false}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
