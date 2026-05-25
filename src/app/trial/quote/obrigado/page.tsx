'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, Mail, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const NEXT_STEPS = [
  {
    icon: Clock,
    title: 'Em até 24h',
    desc: 'Nossa equipe analisa suas respostas e prepara uma proposta personalizada para o perfil da sua empresa.',
  },
  {
    icon: Mail,
    title: 'Proposta por e-mail',
    desc: 'Você receberá uma proposta detalhada com valores, plano de implementação e acesso ao dashboard completo.',
  },
  {
    icon: MessageCircle,
    title: 'Alinhamento via WhatsApp',
    desc: 'Se preferir, podemos fazer uma call de 20 minutos para tirar dúvidas e apresentar um caso de uso similar ao seu.',
  },
];

export default function TrialObrigadoPage() {
  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <div className="rounded px-3 py-1.5 text-white text-sm font-bold" style={{ background: '#144660' }}>
            VIVAMENTE360
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full space-y-6">

          {/* ── Success card ─────────────────────────────────────────── */}
          <Card className="border-2 overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #144660, #1ff28d)' }} />
            <CardContent className="pt-8 pb-6 text-center">
              <div
                className="inline-flex rounded-full p-4 mb-4"
                style={{ background: 'rgba(26,162,120,0.1)' }}
              >
                <CheckCircle2 className="h-10 w-10" style={{ color: '#1AA278' }} />
              </div>
              <h1 className="text-2xl font-extrabold text-[#0d2a3d] mb-2">
                Solicitação recebida!
              </h1>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                Obrigado pelo interesse no VIVAMENTE360. Nossa equipe comercial já foi notificada
                e entrará em contato em breve com uma proposta personalizada.
              </p>
            </CardContent>
          </Card>

          {/* ── Próximos passos ──────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
              O que acontece agora
            </p>
            {NEXT_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex gap-4 bg-white rounded-xl border p-4">
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: '#144660' }}
                    >
                      {idx + 1}
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#0d2a3d]">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── CTAs ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <Link href="/trial" className="block">
              <Button variant="outline" className="w-full gap-2">
                Voltar para a página inicial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              Quer acelerar? Nos chame diretamente no{' '}
              <a
                href="https://wa.me/5511999999999"
                className="font-semibold text-[#144660] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
