'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, ArrowRight, Shield, Users, Building2, Phone, Mail,
  MessageSquare, Sparkles, Star,
} from 'lucide-react';

const PAIN_POINTS = [
  'Conformidade NR-1 e auditorias do MTE',
  'Aumento de afastamentos por doenças mentais',
  'Alta rotatividade de colaboradores',
  'Clima organizacional ruim',
  'Pressão da diretoria por indicadores de saúde',
  'Programa de bem-estar sem dados concretos',
  'Falta de argumento para pedir verba ao RH',
  'Desafio em engajar colaboradores na pesquisa',
];

const COMPANY_SIZES = [
  { value: '10-50',  label: '10 a 50 colaboradores' },
  { value: '51-200', label: '51 a 200 colaboradores' },
  { value: '201-500', label: '201 a 500 colaboradores' },
  { value: '501-1000', label: '501 a 1.000 colaboradores' },
  { value: '1001+',  label: 'Acima de 1.000 colaboradores' },
];

const SECTORS = [
  'Indústria / Manufatura',
  'Saúde e Hospitalar',
  'Tecnologia',
  'Varejo e Comércio',
  'Construção Civil',
  'Financeiro / Seguros',
  'Educação',
  'Logística e Transporte',
  'Serviços',
  'Outro',
];

type FormData = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  companySize: string;
  sector: string;
  role: string;
  painPoints: string[];
  interest: number;
  message: string;
};

const INITIAL: FormData = {
  name: '', email: '', phone: '', companyName: '',
  companySize: '', sector: '', role: '',
  painPoints: [], interest: 0, message: '',
};

const INTEREST_LABELS: Record<number, string> = {
  0:  '— Clique para avaliar —',
  1:  'Apenas curiosidade',
  2:  'Pouco interesse',
  3:  'Interesse moderado',
  4:  'Bastante interessado',
  5:  'Muito interessado',
  6:  'Quero apresentar à diretoria',
  7:  'Tenho orçamento disponível',
  8:  'Quero contratar em breve',
  9:  'Urgente — preciso implementar já',
  10: '🔥 Máximo interesse — quero fechar',
};

const INTEREST_COLOR = (v: number) => {
  if (v === 0) return '#9ca3af';
  if (v <= 3)  return '#F7B511';
  if (v <= 6)  return '#F75900';
  return '#009B00';
};

export default function TrialQuotePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [hovered, setHovered] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const displayInterest = hovered || form.interest;

  const set = (key: keyof FormData, value: string | number | string[]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const togglePainPoint = (point: string) => {
    set(
      'painPoints',
      form.painPoints.includes(point)
        ? form.painPoints.filter((p) => p !== point)
        : [...form.painPoints, point],
    );
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim())        errs.name = 'Obrigatório';
    if (!form.email.includes('@')) errs.email = 'E-mail inválido';
    if (!form.companyName.trim()) errs.companyName = 'Obrigatório';
    if (!form.companySize)        errs.companySize = 'Obrigatório';
    if (form.interest === 0)      errs.interest = 'Avalie seu interesse';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await fetch('/api/trial/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          trial_responses: (() => {
            try { return localStorage.getItem('trial_responses'); } catch { return null; }
          })(),
        }),
      });
    } catch {
      // fire-and-forget — if it fails we still redirect to thank you
    }
    router.push('/trial/quote/obrigado');
  };

  return (
    <div className="min-h-screen bg-[#f8fafb]">

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="rounded px-3 py-1.5 text-white text-sm font-bold" style={{ background: '#144660' }}>
            VIVAMENTE360
          </div>
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <Shield className="h-3 w-3" style={{ color: '#1AA278' }} />
            Proposta Gratuita
          </Badge>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Progress banner ──────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0d2a3d 0%, #144660 100%)' }}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-full p-2" style={{ background: 'rgba(31,242,141,0.15)' }}>
              <Sparkles className="h-5 w-5" style={{ color: '#1ff28d' }} />
            </div>
            <div>
              <p className="font-bold text-base mb-0.5">Você está a 1 passo do relatório completo</p>
              <p className="text-white/65 text-sm">
                Preencha o formulário abaixo e nossa equipe envia uma proposta personalizada com acesso ao
                dashboard completo, análise por setor e relatório PGR — em até 24h.
              </p>
            </div>
          </div>
        </div>

        {/* ── Termômetro de interesse ───────────────────────────────────── */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: '#F7B511' }} />
              Qual é o seu nível de interesse?
            </CardTitle>
            <CardDescription>Esta informação nos ajuda a priorizar o atendimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => { set('interest', i); setErrors((e) => ({ ...e, interest: undefined })); }}
                  className="w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all"
                  style={{
                    background: i === 0
                      ? 'transparent'
                      : i <= (displayInterest)
                        ? INTEREST_COLOR(displayInterest)
                        : 'transparent',
                    borderColor: i <= (displayInterest) && i > 0
                      ? INTEREST_COLOR(displayInterest)
                      : '#e5e7eb',
                    color: i === 0
                      ? '#9ca3af'
                      : i <= displayInterest
                        ? '#fff'
                        : '#6b7280',
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
            <p
              className="text-sm font-semibold transition-colors"
              style={{ color: INTEREST_COLOR(displayInterest) }}
            >
              {INTEREST_LABELS[displayInterest]}
            </p>
            {errors.interest && (
              <p className="text-xs text-destructive">{errors.interest}</p>
            )}
          </CardContent>
        </Card>

        {/* ── Dores / motivações ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">O que motivou você a buscar esta solução?</CardTitle>
            <CardDescription>Selecione todos que se aplicam</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PAIN_POINTS.map((point) => {
                const selected = form.painPoints.includes(point);
                return (
                  <button
                    key={point}
                    onClick={() => togglePainPoint(point)}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                      selected
                        ? 'border-[#144660] bg-[#144660] text-white'
                        : 'border-gray-200 bg-white text-muted-foreground hover:border-[#144660] hover:text-[#144660]',
                    ].join(' ')}
                  >
                    {selected && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                    {point}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Dados de contato ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: '#144660' }} />
              Seus dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Cargo</Label>
                <Input
                  id="role"
                  placeholder="ex: Gerente de RH"
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  <Mail className="inline h-3.5 w-3.5 mr-1" />
                  E-mail profissional <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@empresa.com.br"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  <Phone className="inline h-3.5 w-3.5 mr-1" />
                  WhatsApp / Telefone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Dados da empresa ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: '#144660' }} />
              Sua empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Nome da empresa <span className="text-destructive">*</span></Label>
              <Input
                id="companyName"
                placeholder="Nome da empresa"
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
              />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Número de colaboradores <span className="text-destructive">*</span></Label>
                <Select value={form.companySize} onValueChange={(v) => set('companySize', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.companySize && <p className="text-xs text-destructive">{errors.companySize}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Setor de atuação</Label>
                <Select value={form.sector} onValueChange={(v) => set('sector', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">
                <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
                Mensagem (opcional)
              </Label>
              <textarea
                id="message"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Conte-nos mais sobre seu contexto, urgência ou perguntas..."
                value={form.message}
                onChange={(e) => set('message', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Button
            className="w-full py-6 text-base font-bold gap-2"
            style={{ background: '#144660' }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Enviando...' : (
              <>
                Solicitar Proposta Personalizada
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { icon: Shield, text: 'Dados protegidos' },
              { icon: CheckCircle2, text: 'Sem spam' },
              { icon: Users, text: 'Resposta em até 24h' },
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
