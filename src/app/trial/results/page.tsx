'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { ArrowRight, Lock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { calculateHSEITScores, type HSEITScoreResult, type DimensionScore } from '@/lib/scoring';

const SHORT: Record<string, string> = {
  demandas: 'Demandas',
  controle: 'Controle',
  apoio_chefia: 'Ap. Chefia',
  apoio_colegas: 'Ap. Colegas',
  relacionamentos: 'Relacion.',
  cargo: 'Cargo',
  comunicacao_mudancas: 'Com./Mud.',
};

const LEVEL_LABEL: Record<string, string> = {
  aceitavel: 'Aceitável',
  moderado: 'Moderado',
  importante: 'Importante',
  critico: 'Crítico',
};

const INSIGHT: Record<string, string> = {
  demandas: 'A carga de trabalho está pesando — prazos irreais e volume excessivo aparecem como padrão consistente.',
  controle: 'Falta espaço para decidir como o trabalho é feito. Autonomia baixa tende a aumentar o desgaste ao longo do tempo.',
  apoio_chefia: 'O suporte das lideranças não está chegando onde precisa. Isso costuma ser o gatilho principal de afastamentos.',
  apoio_colegas: 'O time não está se apoiando como deveria — e isso isola as pessoas quando as coisas ficam difíceis.',
  relacionamentos: 'Há tensões no ambiente que precisam de atenção. Conflitos não resolvidos corroem o clima mais rápido do que qualquer outra coisa.',
  cargo: 'As pessoas não têm clareza sobre o que se espera delas. Role ambiguity é silenciosa e muito custosa.',
  comunicacao_mudancas: 'Mudanças acontecem sem comunicação adequada. A insegurança gerada aqui aparece em quase todas as outras dimensões.',
};

function Tooltip2({ active, payload }: { active?: boolean; payload?: { payload: { name: string; NR: number; color: string; label: string } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-[#0d2a3d] mb-1">{d.name}</p>
      <p style={{ color: d.color }} className="font-medium">{d.label}</p>
      <p className="text-muted-foreground">NR {d.NR}/16</p>
    </div>
  );
}

function RiskBar({ dim }: { dim: DimensionScore }) {
  const pct = (dim.nrValue / 16) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#0d2a3d] font-medium">{dim.name}</span>
        <span className="font-semibold" style={{ color: dim.color }}>{LEVEL_LABEL[dim.riskLevel]}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: dim.color }}
        />
      </div>
    </div>
  );
}

function LockedBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="relative rounded-2xl border border-dashed border-gray-200 overflow-hidden bg-gray-50/50">
      <div className="p-6 select-none" style={{ filter: 'blur(5px)', pointerEvents: 'none' }}>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200/70 rounded-lg" />)}
          </div>
          <div className="h-24 bg-gray-200/50 rounded-xl" />
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/70 backdrop-blur-[2px]">
        <Lock className="h-5 w-5 text-gray-400 mb-2" />
        <p className="font-semibold text-[#0d2a3d] text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{desc}</p>
      </div>
    </div>
  );
}

export default function TrialResultsPage() {
  const [result, setResult] = useState<HSEITScoreResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('trial_responses') ?? sessionStorage.getItem('trial_responses');
      if (raw) setResult(calculateHSEITScores(JSON.parse(raw) as Record<string, number>));
    } catch { /* noop */ }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#144660] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Calculando...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-semibold text-[#0d2a3d]">Resultado não encontrado</p>
          <p className="text-sm text-muted-foreground">Parece que o mapeamento não foi concluído.</p>
          <Link href="/trial/survey" className="inline-flex items-center gap-2 text-sm text-[#144660] font-medium hover:underline">
            Responder agora <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const { dimensions, igrp, igrpInterpretation, igrpColor } = result;
  const worst = [...dimensions].sort((a, b) => b.nrValue - a.nrValue)[0];
  const criticals = dimensions.filter((d) => d.riskLevel === 'critico' || d.riskLevel === 'importante');

  const radarData = dimensions.map((d) => ({
    subject: SHORT[d.key] ?? d.name,
    name: d.name,
    NR: d.nrValue,
    color: d.color,
    label: LEVEL_LABEL[d.riskLevel],
  }));

  return (
    <div className="min-h-screen bg-white">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <Link href="/trial">
          <div className="rounded-lg px-3 py-1.5" style={{ background: '#144660' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Asta" className="h-6 w-auto object-contain" />
          </div>
        </Link>
        <Link href="/trial/survey" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#0d2a3d] transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Refazer
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16 space-y-10">

        {/* ── Score header ─────────────────────────────────────────────── */}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Seu resultado</p>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <span className="text-7xl font-black" style={{ color: igrpColor }}>
                {igrp.toFixed(1)}
              </span>
              <span className="text-2xl text-gray-300 ml-1">/16</span>
            </div>
            <div className="mb-3">
              <p className="text-2xl font-extrabold text-[#0d2a3d]">{igrpInterpretation}</p>
              <p className="text-sm text-muted-foreground">Índice Geral de Risco Psicossocial</p>
            </div>
          </div>
        </div>

        {/* ── Insight personalizado ────────────────────────────────────── */}
        {criticals.length > 0 && (
          <div className="rounded-2xl p-5 border-l-4" style={{ borderColor: worst.color, background: `${worst.color}08` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: worst.color }}>
              Ponto de atenção — {worst.name}
            </p>
            <p className="text-[#0d2a3d] text-sm leading-relaxed">
              {INSIGHT[worst.key] ?? `${worst.name} apresentou risco ${LEVEL_LABEL[worst.riskLevel].toLowerCase()}.`}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Em uma campanha real com toda a equipe, você teria esse mapa detalhado por setor e função — sabendo exatamente onde agir.
            </p>
          </div>
        )}

        {/* ── Radar + barras ───────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Radar das dimensões</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <PolarGrid stroke="#f0f0f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9.5, fill: '#9ca3af' }} />
                <PolarRadiusAxis angle={90} domain={[0, 16]} tick={false} axisLine={false} />
                <Radar dataKey="NR" stroke="#144660" fill="#144660" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip content={<Tooltip2 />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Por dimensão</p>
            <div className="space-y-4">
              {dimensions.map((d) => <RiskBar key={d.key} dim={d} />)}
            </div>
          </div>
        </div>

        {/* ── Bloqueados ───────────────────────────────────────────────── */}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Na versão completa
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <LockedBlock
              title="Análise por Setor"
              desc="Qual área da empresa concentra mais risco?"
            />
            <LockedBlock
              title="Relatório PGR em PDF"
              desc="Pronto para auditorias NR-1 com 1 clique."
            />
            <LockedBlock
              title="Evolução ao longo do tempo"
              desc="Compare campanhas e acompanhe a melhora."
            />
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-10 text-center space-y-5">
          <p className="text-2xl sm:text-3xl font-extrabold text-[#0d2a3d] leading-tight max-w-md mx-auto">
            Sua equipe merece ver esse resultado completo.
          </p>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Proposta personalizada em até 24h. Sem enrolação.
          </p>
          <Link href="/trial/quote">
            <button
              className="inline-flex items-center gap-3 rounded-2xl px-10 py-4 font-bold text-white transition-all hover:scale-105 active:scale-95"
              style={{ background: '#144660', boxShadow: '0 8px 24px rgba(20,70,96,0.3)' }}
            >
              Quero uma proposta
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <p className="text-xs text-muted-foreground/50">Sem compromisso</p>
        </div>
      </div>
    </div>
  );
}
