'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Lock, Shield, BarChart3, FileText, TrendingUp, AlertTriangle,
  CheckCircle2, Users, Sparkles,
} from 'lucide-react';
import { calculateHSEITScores, type HSEITScoreResult } from '@/lib/scoring';

const RISK_BG: Record<string, string> = {
  aceitavel:  'bg-green-50 border-green-200 text-green-800',
  moderado:   'bg-yellow-50 border-yellow-200 text-yellow-800',
  importante: 'bg-orange-50 border-orange-200 text-orange-800',
  critico:    'bg-red-50 border-red-200 text-red-800',
};

const RISK_DOT: Record<string, string> = {
  aceitavel:  '#009B00',
  moderado:   '#F7B511',
  importante: '#F75900',
  critico:    '#F60000',
};

const DIM_SHORT: Record<string, string> = {
  demandas:             'Demandas',
  controle:             'Controle',
  apoio_chefia:         'Ap. Chefia',
  apoio_colegas:        'Ap. Colegas',
  relacionamentos:      'Relacionamentos',
  cargo:                'Cargo',
  comunicacao_mudancas: 'Com./Mudanças',
};

const INSIGHT_MAP: Record<string, string> = {
  demandas:             'sobrecarga e pressão excessiva de trabalho',
  controle:             'baixa autonomia e falta de controle sobre o próprio trabalho',
  apoio_chefia:         'ausência de suporte gerencial e liderança',
  apoio_colegas:        'falta de suporte social e isolamento entre pares',
  relacionamentos:      'conflitos interpessoais e ambiente hostil',
  cargo:                'ambiguidade de papel e falta de clareza de função',
  comunicacao_mudancas: 'comunicação deficiente e gestão de mudanças inadequada',
};

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: { fullName: string; NR: number; color: string; label: string; score: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { fullName, NR, color, label, score } = payload[0].payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs max-w-[180px]">
      <p className="font-semibold mb-1 text-[#0d2a3d]">{fullName}</p>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
        <span>{label}</span>
      </div>
      <p className="text-muted-foreground">NR: <strong className="text-foreground">{NR}</strong>/16</p>
      <p className="text-muted-foreground">Score: <strong className="text-foreground">{score.toFixed(2)}</strong>/4</p>
    </div>
  );
}

function LockedSection({ title, description, icon: Icon }: { title: string; description: string; icon: React.ElementType }) {
  return (
    <div className="relative rounded-2xl border-2 border-dashed border-muted overflow-hidden">
      {/* blurred fake content */}
      <div className="p-6 select-none" style={{ filter: 'blur(6px)', pointerEvents: 'none' }}>
        <div className="space-y-3">
          <div className="h-5 bg-muted rounded w-2/3" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/60 rounded-lg" />
            ))}
          </div>
          <div className="h-32 bg-muted/40 rounded-xl" />
        </div>
      </div>
      {/* overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm p-6 text-center">
        <div className="rounded-full p-3 mb-3" style={{ background: 'rgba(20,70,96,0.08)' }}>
          <Icon className="h-6 w-6" style={{ color: '#144660' }} />
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <p className="font-bold text-[#0d2a3d]">{title}</p>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      </div>
    </div>
  );
}

export default function TrialResultsPage() {
  const [result, setResult] = useState<HSEITScoreResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('trial_responses') ?? sessionStorage.getItem('trial_responses');
      if (raw) {
        const answers = JSON.parse(raw) as Record<string, number>;
        setResult(calculateHSEITScores(answers));
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafb]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#144660] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Calculando seu perfil de risco...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafb] px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 space-y-4">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Nenhum resultado encontrado</h2>
            <p className="text-muted-foreground text-sm">
              Parece que você ainda não respondeu o mapeamento.
            </p>
            <Link href="/trial/survey">
              <Button style={{ background: '#144660' }}>
                Responder Agora →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { dimensions, igrp, igrpInterpretation, igrpColor } = result;
  const worstDim = [...dimensions].sort((a, b) => b.nrValue - a.nrValue)[0];
  const criticalCount = dimensions.filter((d) => d.riskLevel === 'critico').length;
  const importantCount = dimensions.filter((d) => d.riskLevel === 'importante').length;

  const radarData = dimensions.map((d) => ({
    subject: DIM_SHORT[d.key] ?? d.name,
    NR: d.nrValue,
    color: d.color,
    fullName: d.name,
    score: d.rawScore,
    label: d.interpretation,
  }));

  return (
    <div className="min-h-screen bg-[#f8fafb]">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="rounded px-3 py-1.5 text-white text-sm font-bold" style={{ background: '#144660' }}>
            VIVAMENTE360
          </div>
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <Shield className="h-3 w-3" style={{ color: '#1AA278' }} />
            Demo · Dados locais
          </Badge>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── IGRP Hero ──────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 sm:p-8 text-white"
          style={{ background: 'linear-gradient(135deg, #0d2a3d 0%, #144660 100%)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-white/60 text-sm mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: '#1ff28d' }} />
                Seu Perfil de Risco Psicossocial (IGRP)
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
                Índice Geral:{' '}
                <span style={{ color: igrpColor }}>{igrp.toFixed(1)}</span>
                <span className="text-white/40 text-xl"> /16</span>
              </h1>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex px-3 py-1 rounded-full text-sm font-bold"
                  style={{ background: igrpColor, color: '#fff' }}
                >
                  {igrpInterpretation}
                </span>
                <span className="text-white/60 text-sm">Risco Psicossocial</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:text-right">
              {criticalCount > 0 && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-2xl font-extrabold" style={{ color: '#F60000' }}>{criticalCount}</p>
                  <p className="text-xs text-white/60">Dimensões Críticas</p>
                </div>
              )}
              {importantCount > 0 && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-2xl font-extrabold" style={{ color: '#F75900' }}>{importantCount}</p>
                  <p className="text-xs text-white/60">Importantes</p>
                </div>
              )}
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-2xl font-extrabold" style={{ color: '#1ff28d' }}>7</p>
                <p className="text-xs text-white/60">Dimensões avaliadas</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-2xl font-extrabold" style={{ color: '#1ff28d' }}>35</p>
                <p className="text-xs text-white/60">Questões HSE-IT</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Insight personalizado ──────────────────────────────────────── */}
        {(worstDim.riskLevel === 'critico' || worstDim.riskLevel === 'importante') && (
          <div
            className={`rounded-2xl border p-4 flex items-start gap-3 ${RISK_BG[worstDim.riskLevel]}`}
          >
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: RISK_DOT[worstDim.riskLevel] }} />
            <div>
              <p className="font-semibold text-sm">
                Alerta: {worstDim.interpretation} em <span className="underline">{worstDim.name}</span>
              </p>
              <p className="text-sm mt-0.5 opacity-80">
                Seus resultados indicam {INSIGHT_MAP[worstDim.key] ?? 'risco elevado'} — uma das principais causas de
                afastamentos e baixa produtividade. Em uma campanha real com toda sua equipe, você teria o mapa completo
                por setor e cargo para agir exatamente onde é necessário.
              </p>
            </div>
          </div>
        )}

        {/* ── Radar + Dimensões ─────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-5 gap-6">

          {/* Radar */}
          <Card className="sm:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Radar das 7 Dimensões HSE-IT</CardTitle>
              <CardDescription>NR por dimensão — escala 1 a 16</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 16]} tick={{ fontSize: 9 }} tickCount={5} />
                  <Radar name="NR" dataKey="NR" stroke="#144660" fill="#144660" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip content={<TooltipContent />} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Dimension list */}
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultado por Dimensão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dimensions.map((d) => (
                <div
                  key={d.key}
                  className="flex items-center justify-between p-2.5 rounded-lg border text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: d.color }}
                    />
                    <span className="truncate text-muted-foreground text-xs">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge
                      className="text-white text-[10px] px-1.5"
                      style={{ background: d.color }}
                    >
                      NR {d.nrValue}
                    </Badge>
                    <span className="text-xs font-medium" style={{ color: d.color }}>
                      {d.interpretation}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Seções bloqueadas (FOMO) ───────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Disponível na versão completa
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <LockedSection
              title="Análise por Setor e Cargo"
              description="Veja qual setor tem maior risco e quais funções estão mais expostas."
              icon={BarChart3}
            />
            <LockedSection
              title="Relatório PGR em PDF"
              description="Documento completo para auditorias NR-1, com metodologia e plano de ação."
              icon={FileText}
            />
            <LockedSection
              title="Histórico e Comparativo"
              description="Acompanhe a evolução das dimensões ao longo das campanhas."
              icon={TrendingUp}
            />
          </div>
        </div>

        {/* ── CTA de conversão ──────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 sm:p-8 text-center"
          style={{ background: 'linear-gradient(135deg, #144660 0%, #1a5a80 100%)' }}
        >
          <div className="inline-flex rounded-full p-2 mb-4" style={{ background: 'rgba(31,242,141,0.15)' }}>
            <Sparkles className="h-5 w-5" style={{ color: '#1ff28d' }} />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
            Agora imagine isso para toda a sua equipe
          </h2>
          <p className="text-white/70 mb-1 max-w-xl mx-auto text-sm sm:text-base">
            Com o VIVAMENTE360, você mapeia todos os colaboradores, obtém análise por setor, gera o
            relatório PGR em 1 clique — e garante conformidade NR-1 com anonimato comprovado.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 my-6 text-sm text-white/60">
            {[
              { icon: Users, text: '47.000+ colaboradores mapeados' },
              { icon: Shield, text: 'LGPD compliant' },
              { icon: CheckCircle2, text: 'NR-1 auditável' },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4" style={{ color: '#1ff28d' }} />
                {text}
              </span>
            ))}
          </div>

          <Link href="/trial/quote">
            <Button
              size="lg"
              className="gap-2 font-bold text-base px-8 py-5"
              style={{ background: '#1ff28d', color: '#0d2a3d' }}
            >
              Quero Implementar na Minha Empresa
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-3 text-white/40 text-xs">
            Proposta personalizada em até 24h · Sem compromisso
          </p>
        </div>
      </div>
    </div>
  );
}
