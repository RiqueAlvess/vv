'use client';

import Link from 'next/link';
import { Shield, Eye, BarChart3, ArrowRight, CheckCircle2, Users, Building2, FileText, Lock, Zap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DIFFERENTIALS = [
  {
    icon: Eye,
    color: '#1AA278',
    bgColor: 'rgba(26,162,120,0.1)',
    badge: 'Tecnologia Exclusiva',
    title: 'Anonimato Comprovado',
    description:
      'Tecnologia Blind-Drop™ — as respostas não possuem nenhum vínculo técnico com o respondente. Nem a empresa, nem a plataforma conseguem rastrear quem respondeu o quê.',
    points: [
      'Token de acesso destruído após uso',
      'Zero FK entre resposta e colaborador',
      'LGPD art. 12 — dado anonimizado',
    ],
  },
  {
    icon: Shield,
    color: '#144660',
    bgColor: 'rgba(20,70,96,0.1)',
    badge: 'Segurança Militar',
    title: 'Criptografia AES-256',
    description:
      'Todos os dados transitam e residem com criptografia AES-256-GCM. E-mails de colaboradores são deletados permanentemente após o envio — impossível recuperá-los.',
    points: [
      'AES-256-GCM em repouso e em trânsito',
      'E-mails deletados após primeiro envio',
      'Infraestrutura Supabase + Vercel',
    ],
  },
  {
    icon: BarChart3,
    color: '#F75900',
    bgColor: 'rgba(247,89,0,0.1)',
    badge: 'Conformidade NR-1',
    title: 'Dashboard & Relatório PGR',
    description:
      'Radar de 7 dimensões HSE-IT, score IGRP, análise por setor e cargo, e relatório PGR pronto para auditorias — tudo gerado automaticamente ao fechar a campanha.',
    points: [
      'Relatório PDF em 1 clique (NR-1)',
      'Análise por setor, cargo e gênero',
      'Score IGRP + nível de risco por dimensão',
    ],
  },
];

const STEPS = [
  { n: '01', title: 'Configure a Campanha', desc: 'Crie sua campanha em minutos. Importe colaboradores via CSV com nome, setor e cargo.' },
  { n: '02', title: 'Envio Automático', desc: 'O sistema dispara QR Codes individuais para cada colaborador de forma totalmente automatizada.' },
  { n: '03', title: 'Respostas Anônimas', desc: 'Colaboradores respondem 35 questões HSE-IT com garantia total de anonimato.' },
  { n: '04', title: 'Relatório Instantâneo', desc: 'Dashboard completo e relatório PGR gerado automaticamente assim que a campanha é encerrada.' },
];

const STATS = [
  { value: '312+', label: 'Empresas atendidas' },
  { value: '47.000+', label: 'Colaboradores mapeados' },
  { value: '99.8%', label: 'Taxa de conformidade NR-1' },
  { value: '< 3h', label: 'Para ter o primeiro relatório' },
];

export default function TrialLandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="rounded px-3 py-1.5 text-white text-sm font-bold tracking-wide"
              style={{ background: '#144660' }}
            >
              VIVAMENTE360
            </div>
            <Badge variant="secondary" className="text-xs hidden sm:inline-flex">Beta</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">Já tem conta?</span>
            <Link href="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link href="/trial/survey">
              <Button size="sm" style={{ background: '#1ff28d', color: '#0d2a3d' }} className="font-semibold">
                Experimentar Grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0d2a3d] via-[#144660] to-[#1a5a80] text-white py-20 sm:py-28 px-4">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <Badge
            className="mb-6 inline-flex items-center gap-1.5 border-white/20 text-white/80 bg-white/10"
            variant="outline"
          >
            <Zap className="h-3 w-3" style={{ color: '#1ff28d' }} />
            Conformidade NR-1 · Instrumento HSE-IT · LGPD
          </Badge>

          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-5 tracking-tight">
            Mapeie os Riscos Psicossociais
            <span className="block" style={{ color: '#1ff28d' }}>da sua empresa em horas</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/75 max-w-2xl mx-auto mb-8 leading-relaxed">
            A única plataforma com tecnologia de anonimato comprovado que seus colaboradores
            confiam — e os auditores NR-1 aceitam.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/trial/survey">
              <Button
                size="lg"
                className="gap-2 font-bold text-base px-8"
                style={{ background: '#1ff28d', color: '#0d2a3d' }}
              >
                Responder o Mapeamento Agora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-sm text-white/50">Sem cadastro · Sem senha · 8 minutos</p>
          </div>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#1ff28d' }}>{s.value}</p>
                <p className="text-xs sm:text-sm text-white/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diferenciais ───────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[#f8fafb]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0d2a3d] mb-3">
              Por que equipes de RH escolhem VIVAMENTE360
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              O diferencial está onde ninguém consegue copiar: a confiança dos colaboradores.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {DIFFERENTIALS.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.title}
                  className="bg-white rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="rounded-xl p-3 shrink-0"
                      style={{ background: d.bgColor }}
                    >
                      <Icon className="h-6 w-6" style={{ color: d.color }} />
                    </div>
                    <div>
                      <Badge
                        variant="secondary"
                        className="mb-1 text-xs"
                        style={{ color: d.color }}
                      >
                        {d.badge}
                      </Badge>
                      <h3 className="font-bold text-[#0d2a3d]">{d.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{d.description}</p>
                  <ul className="space-y-1.5">
                    {d.points.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: d.color }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0d2a3d] mb-3">
              Do upload ao relatório NR-1 em 4 passos
            </h2>
            <p className="text-muted-foreground">Implementação feita pelo próprio time de RH, sem TI.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div
                  className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: '#144660' }}
                >
                  {s.n}
                </div>
                <div>
                  <h3 className="font-bold text-[#0d2a3d] mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Para quem é ────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[#f8fafb]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0d2a3d] mb-3">
              Ideal para empresas que levam NR-1 a sério
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Building2, title: 'Gestores de RH', desc: 'Cumpra a NR-1 sem depender do jurídico ou de TI. Configure, dispare e receba o relatório — tudo dentro do painel.' },
              { icon: Users, title: 'Colaboradores', desc: 'Respondam sabendo que ninguém vai saber que foi você. Tecnologia Blind-Drop™ auditada e documentada.' },
              { icon: FileText, title: 'Auditores e Médicos do Trabalho', desc: 'Relatório PGR em PDF com metodologia HSE-IT, IGRP e matriz de risco NR prontos para homologação.' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-white rounded-2xl border p-6 text-center shadow-sm">
                  <div className="inline-flex rounded-full p-3 mb-4" style={{ background: 'rgba(20,70,96,0.08)' }}>
                    <Icon className="h-6 w-6" style={{ color: '#144660' }} />
                  </div>
                  <h3 className="font-bold text-[#0d2a3d] mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Final ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(135deg, #0d2a3d 0%, #144660 100%)' }}>
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-4">
            Experimente o mapeamento agora
          </h2>
          <p className="text-white/70 text-lg mb-3">
            Responda as 35 questões HSE-IT (8 minutos) e veja um preview real do dashboard com o seu perfil de risco psicossocial.
          </p>
          <p className="text-white/50 text-sm mb-8">
            Sem cadastro. Sem senha. Sem compromisso.
          </p>
          <Link href="/trial/survey">
            <Button
              size="lg"
              className="gap-2 font-bold text-base px-10 py-6"
              style={{ background: '#1ff28d', color: '#0d2a3d' }}
            >
              Iniciar Mapeamento Gratuito
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>

          <div className="mt-10 flex items-center justify-center gap-6 flex-wrap">
            {[
              { icon: Lock, text: 'Anonimato garantido' },
              { icon: Shield, text: 'Dados criptografados' },
              { icon: CheckCircle2, text: 'NR-1 compliant' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-white/60">
                <Icon className="h-4 w-4" style={{ color: '#1ff28d' }} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-4 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div
            className="rounded px-3 py-1.5 text-white text-sm font-bold"
            style={{ background: '#144660' }}
          >
            VIVAMENTE360
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} VIVAMENTE360 · Plataforma de Riscos Psicossociais NR-1 ·
            Metodologia HSE-IT · LGPD compliant
          </p>
        </div>
      </footer>
    </div>
  );
}
