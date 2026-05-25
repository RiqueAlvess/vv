'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Shield, Eye, BarChart3, ArrowDown, CheckCircle2, ArrowRight,
  FileCheck, Bot, MessageSquare, LayoutDashboard, AlertTriangle,
} from 'lucide-react';

// ── Analytics tracking ──────────────────────────────────────────────────────

function trackEvent(type: string, payload?: Record<string, unknown>) {
  try {
    const events: unknown[] = JSON.parse(localStorage.getItem('trial_analytics') ?? '[]');
    events.push({ type, ts: Date.now(), ...payload });
    localStorage.setItem('trial_analytics', JSON.stringify(events.slice(-200)));
  } catch { /* noop */ }
}

// ── Reveal on scroll ────────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`rv ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

const CID_F = [
  { label: 'F41 · Ansiedade', cases: 4297, color: '#F60000' },
  { label: 'F43 · Stress/Adaptação', cases: 2506, color: '#F75900' },
  { label: 'F32 · Depressão', cases: 1745, color: '#F7B511' },
  { label: 'F33 · Dep. Recorrente', cases: 619, color: '#b45309' },
  { label: 'F31 · Bipolar', cases: 244, color: '#6b7280' },
];

const STATS = [
  { value: '9.411', label: 'afastamentos por saúde mental em 2024', sub: 'Fonte: Previdência Social' },
  { value: '4.297', label: 'casos de transtorno de ansiedade (F41)', sub: 'CID mais comum entre CID-F' },
  { value: '52%', label: 'dos casos de depressão sem CAT formal', sub: 'Subnotificação preocupante' },
  { value: 'R$ 40k+', label: 'custo médio por CAT por saúde mental', sub: 'INSS + absenteísmo + turnover' },
];

const DIFFERENTIALS = [
  {
    icon: Eye, color: '#1AA278', bg: 'rgba(26,162,120,0.08)', badge: 'Exclusivo',
    title: 'Anonimato Comprovado',
    desc: 'Tecnologia Blind-Drop™ — nenhuma resposta possui vínculo técnico com o colaborador. Nem a empresa, nem a plataforma conseguem identificar quem respondeu.',
    points: [
      'Token de identificação destruído após o acesso',
      'Nenhum vínculo entre resposta e colaborador',
      'LGPD art. 12 — dado anonimizado por lei',
    ],
  },
  {
    icon: Shield, color: '#144660', bg: 'rgba(20,70,96,0.08)', badge: 'Segurança',
    title: 'Criptografia AES-256',
    desc: 'Todos os dados transitam e residem com criptografia AES-256-GCM. Os dados coletados são deletados permanentemente após o processamento.',
    points: [
      'AES-256-GCM em repouso e em trânsito',
      'Dados deletados após a coleta',
      'Infraestrutura robusta com servidores que atendem todo o Brasil',
    ],
  },
  {
    icon: BarChart3, color: '#b45309', bg: 'rgba(180,83,9,0.08)', badge: 'NR-1',
    title: 'Dashboard & Relatório PGR',
    desc: 'Radar das 7 dimensões HSE-IT, score IGRP, análise por setor e cargo, e relatório PGR pronto para auditorias — gerado automaticamente ao encerrar a campanha.',
    points: [
      'Relatório PDF completo em 1 clique',
      'Análise por setor, cargo e gênero',
      'Score IGRP + classificação de risco por dimensão',
    ],
  },
];

const FEATURES = [
  {
    icon: FileCheck, color: '#144660', bg: 'rgba(20,70,96,0.07)',
    title: 'Checklist de Conformidade',
    desc: 'Registro auditável de cada etapa do processo — com upload de PDFs, evidências e arquivos. Em caso de fiscalização, tudo está documentado e rastreável no sistema.',
  },
  {
    icon: Bot, color: '#1AA278', bg: 'rgba(26,162,120,0.07)',
    title: 'Plano de Ação por IA',
    desc: 'Para as dimensões com risco crítico, nossa IA treinada com dados do MTE gera um plano de ação prioritizado com recomendações práticas para o time de RH.',
  },
  {
    icon: MessageSquare, color: '#7c3aed', bg: 'rgba(124,58,237,0.07)',
    title: 'Canal de Denúncia Anônima',
    desc: 'Módulo dedicado para colaboradores comunicarem situações de risco, assédio ou irregularidades com total sigilo. Um canal seguro que aumenta a confiança no processo.',
  },
  {
    icon: LayoutDashboard, color: '#b45309', bg: 'rgba(180,83,9,0.07)',
    title: 'Dashboard por Campanha',
    desc: 'Cada campanha tem seu próprio painel de resultados, isolado e independente. Comparativos históricos disponíveis para acompanhar a evolução ao longo do tempo.',
  },
];

const STEPS = [
  {
    n: '01', title: 'Configure a Campanha',
    desc: 'Crie sua campanha em minutos. Registre colaboradores em massa via upload.',
  },
  {
    n: '02', title: 'Gere os Acessos',
    desc: 'O sistema gera um link ou QR Code. O próprio time de RH distribui o acesso. O colaborador abre de qualquer dispositivo, onde e quando quiser.',
  },
  {
    n: '03', title: 'Respostas Anônimas',
    desc: 'Colaboradores respondem 35 questões HSE-IT com garantia total de anonimato. Sem cadastro.',
  },
  {
    n: '04', title: 'Relatório Instantâneo',
    desc: 'Dashboard completo e relatório PGR gerado automaticamente assim que a campanha é encerrada.',
  },
];

const FOR_WHO = [
  {
    img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
    title: 'Gestores de RH',
    desc: 'Cumpra a NR-1 sem depender do jurídico ou de TI. Configure, gere os acessos e receba o relatório — tudo no próprio painel.',
  },
  {
    img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80',
    title: 'Colaboradores',
    desc: 'Respondam de qualquer dispositivo, sabendo que ninguém vai saber que foi você. Tecnologia Blind-Drop™ auditada e documentada.',
  },
  {
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
    title: 'Auditores e Médicos do Trabalho',
    desc: 'Relatório PGR em PDF com metodologia HSE-IT, score IGRP e matriz de risco NR prontos para homologação e fiscalização.',
  },
];

// ── Custom recharts tooltip ──────────────────────────────────────────────────

function CidTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { label: string; color: string } }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-[#0d2a3d]">{payload[0].payload.label}</p>
      <p style={{ color: payload[0].payload.color }} className="font-bold text-base">
        {payload[0].value.toLocaleString('pt-BR')} casos
      </p>
      <p className="text-muted-foreground">Previdência Social — 2024</p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function TrialLandingPage() {

  // Analytics: track enter/exit
  useEffect(() => {
    const enterAt = Date.now();
    trackEvent('landing_enter');

    const handleVis = () => {
      if (document.hidden) {
        trackEvent('landing_blur', { duration_ms: Date.now() - enterAt });
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      trackEvent('landing_exit', { duration_ms: Date.now() - enterAt });
    };
  }, []);

  return (
    <>
      <style>{`
        .rv { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .rv.visible { opacity: 1; transform: translateY(0); }
        @keyframes fd { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .fd > * { animation: fd 0.7s ease both; }
        .fd > *:nth-child(1) { animation-delay: 0.1s; }
        .fd > *:nth-child(2) { animation-delay: 0.25s; }
        .fd > *:nth-child(3) { animation-delay: 0.4s; }
        .fd > *:nth-child(4) { animation-delay: 0.55s; }
        .fd > *:nth-child(5) { animation-delay: 0.7s; }
        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        .bob { animation: bob 2.8s ease-in-out infinite; }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden"
        style={{ background: 'linear-gradient(155deg, #07192a 0%, #144660 60%, #0e3d58 100%)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1920&q=50"
          alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-[0.1] mix-blend-luminosity pointer-events-none"
        />
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)', backgroundSize: '34px 34px' }} />
        <div className="absolute top-1/3 left-1/5 w-80 h-80 rounded-full opacity-[0.08] blur-3xl pointer-events-none" style={{ background: '#1ff28d' }} />

        <div className="relative z-10 text-center max-w-3xl fd">
          {/* Asta logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Asta" className="h-10 w-auto object-contain mx-auto mb-8" />

          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-1.5 text-xs text-white/55 mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1ff28d] animate-pulse" />
            Conformidade NR-1 · Instrumento HSE-IT · LGPD
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Por que equipes de RH escolhem
          </h1>
          {/* Vivamente360 with brand colors */}
          <div className="flex justify-center mb-6">
            <svg viewBox="0 0 415 52" height="52" style={{ overflow: 'visible' }} className="w-auto max-w-full" aria-label="Vivamente360">
              <text x="0" y="44" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="46" letterSpacing="-1">
                <tspan fill="#FFFFFF">Vivamente</tspan><tspan fill="#1ff28d">360</tspan>
              </text>
            </svg>
          </div>

          <p className="text-base sm:text-lg text-white/55 max-w-xl mx-auto leading-relaxed mb-8">
            O diferencial está onde ninguém consegue copiar: a confiança dos colaboradores.
          </p>

          <Link href="/trial/survey" onClick={() => trackEvent('hero_cta_click')}>
            <button
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              style={{ background: '#1ff28d', color: '#0d2a3d', boxShadow: '0 6px 24px rgba(31,242,141,0.3)' }}
            >
              Ver o mapeamento na prática
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>

        <div className="absolute bottom-8 flex flex-col items-center gap-2 bob">
          <span className="text-[10px] text-white/30 uppercase tracking-widest">Role para baixo</span>
          <ArrowDown className="h-4 w-4 text-white/25" />
        </div>
      </section>

      {/* ── CID F — Impacto ─────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" style={{ color: '#F60000' }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-red-600">
                Previdência Social — dados de 2024
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a3d] mb-2">
              Saúde mental no trabalho é a nova epidemia silenciosa
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-10">
              Os transtornos mentais (CID F) já figuram entre as principais causas de afastamento no Brasil —
              e grande parte dos casos ainda segue sem registro formal. A NR-1 exige que sua empresa mapeie
              esses riscos e aja sobre eles.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-4 gap-4 mb-12">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="rounded-2xl border p-5 bg-[#f7f8f6]">
                  <p className="text-3xl font-extrabold text-[#0d2a3d] mb-1">{s.value}</p>
                  <p className="text-sm text-[#0d2a3d]/80 font-medium leading-snug mb-1">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="bg-[#f7f8f6] rounded-2xl p-6">
              <p className="text-sm font-semibold text-[#0d2a3d] mb-4">
                Afastamentos por transtorno mental (CID F) — 2024
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={CID_F} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} width={140} />
                  <RechartTooltip content={<CidTooltip />} />
                  <Bar dataKey="cases" radius={[0, 6, 6, 0]}>
                    {CID_F.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-3">
                * A depressão (F32) é o único grupo com mais casos <strong>sem</strong> registro formal (CAT)
                do que com — sinal claro de subnotificação e urgência de mapeamento preventivo.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Diferenciais ────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-[#f7f8f6]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a3d] mb-2">
                Uma plataforma construída para gerar confiança
              </h2>
              <p className="text-muted-foreground">
                Colaboradores só participam de verdade quando confiam no processo.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-5">
            {DIFFERENTIALS.map((d, i) => {
              const Icon = d.icon;
              return (
                <Reveal key={d.title} delay={i * 100}>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="rounded-xl p-3 shrink-0" style={{ background: d.bg }}>
                        <Icon className="h-5 w-5" style={{ color: d.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: d.color }}>{d.badge}</p>
                        <h3 className="font-bold text-[#0d2a3d] leading-tight">{d.title}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{d.desc}</p>
                    <ul className="space-y-1.5">
                      {d.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: d.color }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Funcionalidades extras ──────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a3d] mb-2">
                Mais do que um questionário
              </h2>
              <p className="text-muted-foreground">
                Uma plataforma completa de gestão de riscos psicossociais.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 80}>
                  <div className="flex gap-4 rounded-2xl border border-gray-100 p-5 bg-[#f7f8f6] hover:bg-white transition-colors">
                    <div className="rounded-xl p-3 shrink-0 h-fit" style={{ background: f.bg }}>
                      <Icon className="h-5 w-5" style={{ color: f.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#0d2a3d] mb-1">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Como funciona ───────────────────────────────────────────────── */}
      <section
        className="py-24 px-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d2a3d 0%, #144660 100%)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=30"
          alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-[0.07] mix-blend-luminosity pointer-events-none"
        />
        <div className="relative max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">
                Do cadastro ao relatório em 4 passos
              </h2>
              <p className="text-white/45">Feito pelo próprio time de RH. Sem depender de TI.</p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-5">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm hover:bg-white/8 transition-colors">
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-base"
                    style={{ background: 'rgba(31,242,141,0.12)', color: '#1ff28d' }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">{s.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Para quem ───────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a3d] mb-2">
                Ideal para empresas que levam NR-1 a sério
              </h2>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-5">
            {FOR_WHO.map((item, i) => (
              <Reveal key={item.title} delay={i * 100}>
                <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative h-44 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,42,61,0.65) 0%, transparent 55%)' }} />
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-[#0d2a3d] mb-1.5">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ───────────────────────────────────────────────────── */}
      <section className="py-32 px-4 bg-[#f7f8f6] flex flex-col items-center text-center">
        <Reveal>
          <div className="max-w-md mx-auto space-y-7">
            <div className="inline-flex rounded-lg px-4 py-2 mx-auto" style={{ background: '#144660' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Asta" className="h-7 w-auto object-contain" />
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#0d2a3d] leading-tight">
              Veja como sua empresa está de verdade.
            </p>
            <p className="text-muted-foreground">
              Responda as 35 questões HSE-IT (8 minutos) e receba um preview real do seu perfil de risco psicossocial.
            </p>
            <Link href="/trial/survey" onClick={() => trackEvent('cta_final_click')}>
              <button
                className="inline-flex items-center gap-3 rounded-2xl px-12 py-5 text-lg font-bold transition-all hover:scale-105 active:scale-95"
                style={{ background: '#144660', color: '#fff', boxShadow: '0 8px 32px rgba(20,70,96,0.3)' }}
              >
                Testar Agora
                <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
            <p className="text-xs text-muted-foreground/50">
              Sem cadastro · Sem senha · Resultado imediato
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
