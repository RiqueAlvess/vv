'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, CheckCircle2, AlertCircle, Loader2, MessageSquare } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'positivo',  label: 'Feedback Positivo',  desc: 'Algo que está funcionando bem' },
  { value: 'negativo',  label: 'Feedback Negativo',  desc: 'Algo que precisa melhorar' },
  { value: 'sugestao',  label: 'Sugestão',           desc: 'Ideia para melhoria' },
  { value: 'outro',     label: 'Outro',              desc: 'Qualquer outro assunto' },
];

const CATEGORY_OPTIONS = [
  { value: 'lideranca',       label: 'Liderança' },
  { value: 'carga_trabalho',  label: 'Carga de Trabalho' },
  { value: 'relacionamentos', label: 'Relacionamentos' },
  { value: 'comunicacao',     label: 'Comunicação' },
  { value: 'beneficios',      label: 'Benefícios' },
  { value: 'ambiente',        label: 'Ambiente de Trabalho' },
  { value: 'outro',           label: 'Outro' },
];

type Step = 'loading' | 'invalid' | 'form' | 'submitting' | 'done';

export default function FeedbackPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [companyName, setCompanyName] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/feedback/${token}`)
      .then(res => res.json())
      .then(data => {
        if (!data.valid) { setStep('invalid'); return; }
        setCompanyName(data.company_name);
        setStep('form');
      })
      .catch(() => setStep('invalid'));
  }, [token]);

  const handleSubmit = async () => {
    if (!type) { setError('Selecione o tipo de feedback'); return; }
    if (message.trim().length < 10) { setError('Mensagem deve ter no mínimo 10 caracteres'); return; }

    setStep('submitting');
    try {
      const res = await fetch(`/api/feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, category: category || undefined, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar'); setStep('form'); return; }
      setStep('done');
    } catch {
      setError('Erro de conexão');
      setStep('form');
    }
  };

  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (step === 'invalid') return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Canal não encontrado</h2>
          <p className="text-muted-foreground text-sm mt-2">Este link é inválido ou o canal foi desativado.</p>
        </CardContent>
      </Card>
    </div>
  );

  if (step === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="py-12">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Feedback enviado!</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Obrigado pela sua contribuição. Seu feedback foi registrado de forma completamente anônima.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40 p-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-6">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MessageSquare className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-xl font-bold">Canal de Feedback Anônimo</h1>
          <p className="text-muted-foreground text-sm mt-1">{companyName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enviar Feedback</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5 text-green-500" />
              100% anônimo — nenhum dado identificador é coletado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Type selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Feedback <span className="text-destructive">*</span></Label>
              <RadioGroup value={type} onValueChange={setType} className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map(opt => (
                  <div key={opt.value}>
                    <RadioGroupItem value={opt.value} id={`type-${opt.value}`} className="peer sr-only" />
                    <Label
                      htmlFor={`type-${opt.value}`}
                      className="flex flex-col gap-0.5 cursor-pointer rounded-lg border p-3 text-sm peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted transition-colors"
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Categoria (opcional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mensagem <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Descreva seu feedback com detalhes. Quanto mais específico, mais útil será para a empresa..."
                value={message}
                onChange={e => { setMessage(e.target.value); setError(''); }}
                rows={5}
                maxLength={2000}
                className="resize-none"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{message.length < 10 ? `Mínimo ${10 - message.length} caracteres` : 'Tamanho adequado'}</span>
                <span>{message.length}/2000</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={step === 'submitting' || !type || message.length < 10}
            >
              {step === 'submitting' ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
              ) : (
                'Enviar Feedback Anônimo'
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Nenhum dado pessoal é coletado. Seu anonimato é garantido tecnicamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
