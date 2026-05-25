'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Shield, Eye, BarChart3, ArrowDown, CheckCircle2, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('revealed'); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal-block ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const DIFFERENTIALS = [
  {
    icon: Eye,
    color: '#1AA278',
    bg: 'rgba(26,162,120,0.08)',
    badge: 'Tecnologia Exclusiva',
    title: 'Anonimato Comprovado',
    description:
      'Tecnologia Blind-Drop™ — as respostas não possuem nenhum vínculo técnico com o respondente. Nem a empresa, nem a plataforma conseguem rastrear quem respondeu o quê.',
    points: ['Token de acesso destruído após uso', 'Zero FK entre resposta e colaborador', 'LGPD art. 12 — dado anonimizado'],
  },
  {
    icon: Shield,
    color: '#144660',
    bg: 'rgba(20,70,96,0.08)',
    badge: 'Segurança Militar',
    title: 'Criptografia AES-256',
    description:
      'Todos os dados transitam e residem com criptografia AES-256-GCM. E-mails de colaboradores são deletados permanentemente após o envio — impossível recuperá-los.',
    points: ['AES-256-GCM em repouso e em trânsito', 'E-mails deletados após primeiro envio', 'Infraestrutura Supabase + Vercel'],
  },
  {
    icon: BarChart3,
    color: '#b45309',
    bg: 'rgba(180,83,9,0.08)',
    badge: 'Conformidade NR-1',
    title: 'Dashboard & Relatório PGR',
    description:
      'Radar de 7 dimensões HSE-IT, score IGRP, análise por setor e cargo, e relatório PGR pronto para auditorias — tudo gerado automaticamente ao fechar a campanha.',
    points: ['Relatório PDF em 1 clique (NR-1)', 'Análise por setor, cargo e gênero', 'Score IGRP + nível de risco por dimensão'],
  },
];

const STEPS = [
  { n: '01', title: 'Configure a Campanha', desc: 'Crie sua campanha em minutos. Importe colaboradores via CSV com nome, setor e cargo.' },
  { n: '02', title: 'Envio Automático', desc: 'O sistema dispara QR Codes individuais para cada colaborador de forma totalmente automatizada.' },
  { n: '03', title: 'Respostas Anônimas', desc: 'Colaboradores respondem 35 questões HSE-IT com garantia total de anonimato.' },
  { n: '04', title: 'Relatório Instantâneo', desc: 'Dashboard completo e relatório PGR gerado automaticamente assim que a campanha é encerrada.' },
];

const FOR_WHO = [
  {
    img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
    title: 'Gestores de RH',
    desc: 'Cumpra a NR-1 sem depender do jurídico ou de TI. Configure, dispare e receba o relatório — tudo dentro do painel.',
  },
  {
    img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80',
    title: 'Colaboradores',
    desc: 'Respondam sabendo que ninguém vai saber que foi você. Tecnologia Blind-Drop™ auditada e documentada.',
  },
  {
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
    title: 'Auditores e Médicos do Trabalho',
    desc: 'Relatório PGR em PDF com metodologia HSE-IT, IGRP e matriz de risco NR prontos para homologação.',
  },
];

export default function TrialLandingPage() {
  return (
    <>
      <style>{`
        .reveal-block {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease, transform 0.65s ease;
        }
        .reveal-block.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .float { animation: float 3s ease-in-out infinite; }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-content > * {
          animation: fadeDown 0.8s ease both;
        }
        .hero-content > *:nth-child(1) { animation-delay: 0.1s; }
        .hero-content > *:nth-child(2) { animation-delay: 0.25s; }
        .hero-content > *:nth-child(3) { animation-delay: 0.4s; }
        .hero-content > *:nth-child(4) { animation-delay: 0.55s; }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #07192a 0%, #144660 55%, #0d3a52 100%)',
        }}
      >
        {/* Background image overlay */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1920&q=60"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12] mix-blend-luminosity"
        />

        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.9) 1px, transparent 0)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: '#1ff28d' }} />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full opacity-10 blur-3xl" style={{ background: '#144660' }} />

        {/* Content */}
        <div className="relative z-10 text-center max-w-3xl hero-content">
          {/* Logo */}
          <div className="flex items-center justify-center mb-10">
            <Logo size={52} variant="light" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-xs text-white/60 mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1ff28d] animate-pulse" />
            NR-1 · HSE-IT · LGPD Compliant
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Por que equipes de RH
            <span className="block" style={{ color: '#1ff28d' }}>escolhem VIVAMENTE360</span>
          </h1>

          <p className="text-lg text-white/55 max-w-xl mx-auto leading-relaxed">
            O diferencial está onde ninguém consegue copiar: a confiança dos colaboradores.
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 float">
          <span className="text-xs text-white/35 tracking-widest uppercase">Role para ver</span>
          <ArrowDown className="h-4 w-4 text-white/30" />
        </div>
      </section>

      {/* ── DIFFERENTIALS ─────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-[#f7f8f6]">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-6">
            {DIFFERENTIALS.map((d, i) => {
              const Icon = d.icon;
              return (
                <Reveal key={d.title} delay={i * 100}>
                  <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm hover:shadow-lg transition-shadow h-full flex flex-col">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="rounded-xl p-3.5 shrink-0" style={{ background: d.bg }}>
                        <Icon className="h-6 w-6" style={{ color: d.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: d.color }}>
                          {d.badge}
                        </p>
                        <h3 className="font-bold text-[#0d2a3d] text-lg leading-tight">{d.title}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{d.description}</p>
                    <ul className="space-y-2">
                      {d.points.map((p) => (
                        <li key={p} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: d.color }} />
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

      {/* ── STEPS ─────────────────────────────────────────────────────────── */}
      <section
        className="py-24 px-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d2a3d 0%, #144660 100%)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=40"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-[0.08] mix-blend-luminosity"
        />
        <div className="relative max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">
                Do upload ao relatório NR-1 em 4 passos
              </h2>
              <p className="text-white/50">Implementação feita pelo próprio time de RH, sem TI.</p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="flex gap-5 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:bg-white/8 transition-colors">
                  <div
                    className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg"
                    style={{ background: 'rgba(31,242,141,0.15)', color: '#1ff28d' }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1.5">{s.title}</h3>
                    <p className="text-sm text-white/55 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR WHO ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0d2a3d] mb-3">
                Ideal para empresas que levam NR-1 a sério
              </h2>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-6">
            {FOR_WHO.map((item, i) => (
              <Reveal key={item.title} delay={i * 100}>
                <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative h-48 overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.img}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,42,61,0.7) 0%, transparent 50%)' }} />
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-[#0d2a3d] mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section className="py-32 px-4 bg-[#f7f8f6] flex flex-col items-center text-center">
        <Reveal>
          <div className="max-w-lg mx-auto space-y-8">
            <div>
              <Logo size={36} variant="dark" />
            </div>
            <p className="text-4xl sm:text-5xl font-extrabold text-[#0d2a3d] leading-tight">
              Veja como sua empresa está de verdade.
            </p>
            <p className="text-muted-foreground text-lg">
              8 minutos. Sem cadastro. Resultado real.
            </p>
            <Link href="/trial/survey">
              <button
                className="inline-flex items-center justify-center gap-3 rounded-2xl px-12 py-5 text-lg font-bold transition-transform hover:scale-105 active:scale-95"
                style={{ background: '#144660', color: '#fff', boxShadow: '0 8px 32px rgba(20,70,96,0.35)' }}
              >
                Testar Agora
                <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
            <p className="text-xs text-muted-foreground/60">
              Sem compromisso · Dados processados localmente · Anonimato garantido
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
