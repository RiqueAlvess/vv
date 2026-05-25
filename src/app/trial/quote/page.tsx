'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, ArrowRight, Shield, Building2, Phone, Mail,
  MessageSquare, Star, X, Clock,
} from 'lucide-react';

// ── Analytics helper ────────────────────────────────────────────────────────

function track(type: string, payload?: Record<string, unknown>) {
  try {
    const events: unknown[] = JSON.parse(localStorage.getItem('trial_analytics') ?? '[]');
    events.push({ type, ts: Date.now(), page: 'quote', ...payload });
    localStorage.setItem('trial_analytics', JSON.stringify(events.slice(-200)));
  } catch { /* noop */ }
}

// ── Constants ───────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  'Conformidade NR-1 e risco de autuação',
  'Aumento de afastamentos por saúde mental',
  'Alta rotatividade e custo de reposição',
  'Clima organizacional deteriorado',
  'Pressão da diretoria por dados de bem-estar',
  'Programa de saúde sem evidências concretas',
  'Dificuldade em engajar colaboradores na pesquisa',
  'Falta de argumento para investimento em RH',
];

const COMPANY_SIZES = [
  { value: '10-50',    label: '10 a 50 colaboradores' },
  { value: '51-200',   label: '51 a 200 colaboradores' },
  { value: '201-500',  label: '201 a 500 colaboradores' },
  { value: '501-1000', label: '501 a 1.000 colaboradores' },
  { value: '1001+',    label: 'Acima de 1.000 colaboradores' },
];

const SECTORS = [
  'Indústria / Manufatura', 'Saúde e Hospitalar', 'Tecnologia',
  'Varejo e Comércio', 'Construção Civil', 'Financeiro / Seguros',
  'Educação', 'Logística e Transporte', 'Serviços', 'Outro',
];

const INTEREST_LABELS: Record<number, string> = {
  0:  '— toque para avaliar —',
  1:  'Curiosidade inicial',
  2:  'Pouco interesse',
  3:  'Interesse moderado',
  4:  'Bastante interessado',
  5:  'Muito interessado',
  6:  'Quero apresentar à diretoria',
  7:  'Tenho verba disponível',
  8:  'Quero contratar em breve',
  9:  'Urgente — precisamos agir já',
  10: '🔥 Interesse máximo — quero fechar',
};

function interestColor(v: number): string {
  if (v === 0) return '#9ca3af';
  if (v <= 3)  return '#F7B511';
  if (v <= 6)  return '#F75900';
  return '#009B00';
}

type FormData = {
  name: string; email: string; phone: string;
  companyName: string; companySize: string; sector: string; role: string;
  painPoints: string[]; interest: number; message: string;
};

// ── Component ───────────────────────────────────────────────────────────────

export default function TrialQuotePage() {
  const router = useRouter();

  const [form, setForm] = useState<FormData>({
    name: '', email: '', phone: '', companyName: '',
    companySize: '', sector: '', role: '',
    painPoints: [], interest: 0, message: '',
  });
  const [hovered, setHovered] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [enterAt] = useState(Date.now);

  // Analytics: track enter
  useEffect(() => {
    track('quote_enter');
  }, []);

  // Exit intent: mouse leaves top of viewport
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (e.clientY <= 0 && !submitting && !showExitPopup) {
        setShowExitPopup(true);
        track('exit_intent_triggered', { time_on_page_ms: Date.now() - enterAt });
      }
    };
    document.addEventListener('mouseleave', handle);
    return () => document.removeEventListener('mouseleave', handle);
  }, [submitting, showExitPopup, enterAt]);

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePain = useCallback((point: string) => {
    setForm((prev) => ({
      ...prev,
      painPoints: prev.painPoints.includes(point)
        ? prev.painPoints.filter((p) => p !== point)
        : [...prev.painPoints, point],
    }));
  }, []);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim())         errs.name = 'Obrigatório';
    if (!form.email.includes('@'))  errs.email = 'E-mail inválido';
    if (!form.companyName.trim())  errs.companyName = 'Obrigatório';
    if (!form.companySize)         errs.companySize = 'Obrigatório';
    if (form.interest === 0)       errs.interest = 'Avalie seu nível de interesse para continuar';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    track('quote_submit', {
      interest: form.interest,
      companySize: form.companySize,
      painPointCount: form.painPoints.length,
      time_on_page_ms: Date.now() - enterAt,
    });
    try {
      const analytics = (() => { try { return localStorage.getItem('trial_analytics'); } catch { return null; } })();
      const responses = (() => { try { return localStorage.getItem('trial_responses'); } catch { return null; } })();
      await fetch('/api/trial/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, trial_responses: responses, analytics }),
      });
    } catch { /* fire-and-forget */ }
    router.push('/trial/quote/obrigado');
  };

  const displayInterest = hovered || form.interest;

  return (
    <div className="min-h-screen bg-[#f7f8f6]">

      {/* ── Exit Intent Popup ──────────────────────────────────────────── */}
      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 relative">
            <button
              onClick={() => { setShowExitPopup(false); track('exit_intent_dismissed'); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-[#0d2a3d] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5" style={{ color: '#F75900' }} />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#F75900' }}>
                Você está quase lá
              </p>
            </div>

            <h2 className="text-xl font-extrabold text-[#0d2a3d] mb-2">
              Não vá ainda — leva menos de 2 minutos
            </h2>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Você já passou pelo mapeamento. O próximo passo é receber uma proposta personalizada para sua empresa —
              com valores, prazo de implementação e acesso ao dashboard completo.
            </p>

            <div className="rounded-xl bg-[#f7f8f6] p-4 mb-5 space-y-2 text-sm">
              <p className="font-medium text-[#0d2a3d]">Em 2024, foram registrados:</p>
              <p className="text-muted-foreground"><strong className="text-red-600">9.411</strong> afastamentos por transtornos mentais no trabalho</p>
              <p className="text-muted-foreground"><strong className="text-orange-600">R$ 40k+</strong> custo médio por cada afastamento por saúde mental</p>
              <p className="text-xs text-muted-foreground/70">Fonte: Previdência Social 2024</p>
            </div>

            <Button
              className="w-full py-4 font-bold text-white"
              style={{ background: '#144660' }}
              onClick={() => { setShowExitPopup(false); track('exit_intent_stayed'); }}
            >
              Continuar e receber minha proposta
            </Button>
            <button
              onClick={() => { setShowExitPopup(false); track('exit_intent_left'); router.push('/trial'); }}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-[#0d2a3d] transition-colors py-2"
            >
              Não, prefiro sair
            </button>
          </div>
        </div>
      )}

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/trial">
            <div className="rounded-lg px-3 py-1.5" style={{ background: '#144660' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Asta" className="h-6 w-auto object-contain" />
            </div>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" style={{ color: '#1AA278' }} />
            Seus dados estão protegidos
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Banner ───────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #0d2a3d 0%, #144660 100%)' }}>
          <p className="font-bold mb-1">Você está a um passo do resultado completo</p>
          <p className="text-white/60 text-sm">
            Preencha abaixo e nossa equipe envia uma proposta personalizada com acesso ao dashboard completo,
            análise por setor e relatório PGR — em até 24h.
          </p>
        </div>

        {/* ── Termômetro de interesse ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-4 w-4" style={{ color: '#F7B511' }} />
            <p className="font-semibold text-[#0d2a3d]">Qual é o seu nível de interesse?</p>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Isso nos ajuda a priorizar o atendimento</p>

          <div className="flex gap-1.5 flex-wrap mb-2">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => { set('interest', i); setErrors((e) => ({ ...e, interest: undefined })); track('interest_set', { value: i }); }}
                className="w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all hover:scale-110"
                style={{
                  background:    i > 0 && i <= displayInterest ? interestColor(displayInterest) : 'transparent',
                  borderColor:   i > 0 && i <= displayInterest ? interestColor(displayInterest) : '#e5e7eb',
                  color:         i === 0 ? '#9ca3af' : i <= displayInterest ? '#fff' : '#6b7280',
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold transition-colors" style={{ color: interestColor(displayInterest) }}>
            {INTEREST_LABELS[displayInterest]}
          </p>
          {errors.interest && <p className="text-xs text-red-500 mt-1">{errors.interest}</p>}
        </div>

        {/* ── Motivações ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="font-semibold text-[#0d2a3d] mb-1">O que motivou você a buscar essa solução?</p>
          <p className="text-xs text-muted-foreground mb-4">Selecione tudo que se aplica</p>
          <div className="flex flex-wrap gap-2">
            {PAIN_POINTS.map((point) => {
              const sel = form.painPoints.includes(point);
              return (
                <button
                  key={point}
                  onClick={() => { togglePain(point); track('pain_point_toggle', { point, selected: !sel }); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all"
                  style={{
                    borderColor: sel ? '#144660' : '#e5e7eb',
                    background:  sel ? '#144660' : 'white',
                    color:       sel ? 'white' : '#6b7280',
                  }}
                >
                  {sel && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                  {point}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Contato ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <p className="font-semibold text-[#0d2a3d]">Seus dados</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome <span className="text-red-500">*</span></Label>
              <Input id="name" placeholder="Seu nome" value={form.name}
                onChange={(e) => set('name', e.target.value)} />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Cargo</Label>
              <Input id="role" placeholder="ex: Gerente de RH" value={form.role}
                onChange={(e) => set('role', e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">
                <Mail className="inline h-3.5 w-3.5 mr-1" />
                E-mail <span className="text-red-500">*</span>
              </Label>
              <Input id="email" type="email" placeholder="voce@empresa.com" value={form.email}
                onChange={(e) => set('email', e.target.value)} />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                <Phone className="inline h-3.5 w-3.5 mr-1" />
                WhatsApp
              </Label>
              <Input id="phone" type="tel" placeholder="(11) 99999-9999" value={form.phone}
                onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Empresa ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <p className="font-semibold text-[#0d2a3d] flex items-center gap-2">
            <Building2 className="h-4 w-4" style={{ color: '#144660' }} />
            Sua empresa
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="company">Nome da empresa <span className="text-red-500">*</span></Label>
            <Input id="company" placeholder="Nome da empresa" value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)} />
            {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Número de colaboradores <span className="text-red-500">*</span></Label>
              <Select value={form.companySize} onValueChange={(v) => set('companySize', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.companySize && <p className="text-xs text-red-500">{errors.companySize}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Setor de atuação</Label>
              <Select value={form.sector} onValueChange={(v) => set('sector', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msg">
              <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
              Mensagem (opcional)
            </Label>
            <textarea
              id="msg" rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="Conte mais sobre o que precisa — urgência, número de unidades, contexto..."
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
            />
          </div>
        </div>

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <div className="space-y-3 pb-4">
          <Button
            className="w-full py-6 text-base font-bold gap-2 text-white"
            style={{ background: '#144660' }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Enviando...' : (
              <><span>Solicitar proposta personalizada</span><ArrowRight className="h-5 w-5" /></>
            )}
          </Button>

          <div className="flex items-center justify-center gap-5 flex-wrap">
            {[
              { icon: Shield, text: 'Dados protegidos' },
              { icon: CheckCircle2, text: 'Sem spam' },
              { icon: CheckCircle2, text: 'Resposta em até 24h' },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" style={{ color: '#1AA278' }} />
                {text}
              </span>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/trial/results" className="hover:underline">← Voltar aos resultados</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
