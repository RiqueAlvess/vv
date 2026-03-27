'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { LIKERT_SCALE, AGE_RANGES, GENDER_OPTIONS } from '@/lib/constants';

const QUESTIONS = [
  { id: 1,  text: 'Eu sei exatamente o que é esperado de mim no trabalho' },
  { id: 2,  text: 'Posso decidir quando fazer uma pausa' },
  { id: 3,  text: 'Diferentes grupos no trabalho exigem coisas de mim que são difíceis de combinar' },
  { id: 4,  text: 'Eu sei como fazer meu trabalho' },
  { id: 5,  text: 'Estou sujeito(a) a atenção pessoal ou assédio na forma de palavras ou comportamentos ofensivos' },
  { id: 6,  text: 'Tenho prazos inatingíveis' },
  { id: 7,  text: 'Se o trabalho fica difícil, meus colegas me ajudam' },
  { id: 8,  text: 'Sou apoiado(a) em uma crise emocional no trabalho' },
  { id: 9,  text: 'Tenho que trabalhar muito intensamente' },
  { id: 10, text: 'Tenho voz nas mudanças no modo como faço meu trabalho' },
  { id: 11, text: 'Tenho tempo suficiente para completar meu trabalho' },
  { id: 12, text: 'Tenho que desconsiderar regras ou procedimentos para fazer o trabalho' },
  { id: 13, text: 'Sei qual é o meu papel e responsabilidades' },
  { id: 14, text: 'Tenho que trabalhar com pessoas que têm valores de trabalho diferentes' },
  { id: 15, text: 'Posso planejar quando fazer as pausas' },
  { id: 16, text: 'Tenho volume de trabalho pesado' },
  { id: 17, text: 'Existe uma boa combinação entre o que a organização espera de mim e as habilidades que tenho' },
  { id: 18, text: 'Tenho que trabalhar muito rapidamente' },
  { id: 19, text: 'Tenho uma palavra a dizer sobre o ritmo em que trabalho' },
  { id: 20, text: 'Tenho que negligenciar alguns aspectos do meu trabalho porque tenho muito a fazer' },
  { id: 21, text: 'Existe fricção ou raiva entre colegas' },
  { id: 22, text: 'Não tenho tempo para fazer uma pausa' },
  { id: 23, text: 'Minha chefia imediata me encoraja no trabalho' },
  { id: 24, text: 'Recebo o respeito no trabalho que mereço de meus colegas' },
  { id: 25, text: 'Tenho controle sobre quando fazer uma pausa' },
  { id: 26, text: 'Os funcionários são sempre consultados sobre mudanças no trabalho' },
  { id: 27, text: 'Posso contar com meus colegas para me ajudar quando as coisas ficam difíceis no trabalho' },
  { id: 28, text: 'Posso conversar com minha chefia sobre algo que me incomodou' },
  { id: 29, text: 'Minha chefia me apoia para o trabalho' },
  { id: 30, text: 'Tenho alguma participação em decisões sobre o meu trabalho' },
  { id: 31, text: 'Recebo ajuda e apoio de meus colegas' },
  { id: 32, text: 'Quando ocorrem mudanças no trabalho, tenho clareza sobre como funcionará na prática' },
  { id: 33, text: 'Recebo feedback sobre o meu trabalho' },
  { id: 34, text: 'Existe tensão entre mim e colegas de trabalho' },
  { id: 35, text: 'Minha chefia me incentiva nas minhas atividades' },
];

type SurveyStep = 'loading' | 'invalid' | 'consent' | 'demographics' | 'questions' | 'submitting' | 'done';

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<SurveyStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(0);

  const questionsPerPage = 7;
  const totalPages = Math.ceil(QUESTIONS.length / questionsPerPage);
  const currentQuestions = QUESTIONS.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);
  const answeredCount = Object.keys(responses).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`/api/survey/${token}`);
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setErrorMsg(data.error || 'Token inválido');
          setStep('invalid');
        } else {
          setStep('consent');
        }
      } catch {
        setErrorMsg('Erro ao validar convite');
        setStep('invalid');
      }
    };
    validate();
  }, [token]);

  const handleSubmit = async () => {
    if (answeredCount < QUESTIONS.length) {
      setErrorMsg('Por favor, responda todas as questões');
      return;
    }

    setStep('submitting');
    try {
      const res = await fetch(`/api/survey/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          gender: gender || undefined,
          age_range: ageRange || undefined,
          consent_accepted: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Erro ao enviar respostas');
        setStep('questions');
        return;
      }

      setStep('done');
    } catch {
      setErrorMsg('Erro de conexão');
      setStep('questions');
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Convite Inválido</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Obrigado!</h2>
            <p className="text-muted-foreground">Sua resposta foi registrada com sucesso. Você pode fechar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-4">
          <div className="flex justify-center mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <h1 className="text-xl font-bold">Pesquisa de Riscos Psicossociais</h1>
          <p className="text-sm text-muted-foreground">Baseada no HSE Management Standards</p>
        </div>

        {/* Consent Step */}
        {step === 'consent' && (
          <Card>
            <CardHeader>
              <CardTitle>Termo de Consentimento</CardTitle>
              <CardDescription>Leia atentamente antes de prosseguir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-3 bg-muted/50 rounded-lg p-4">
                <p>Esta pesquisa tem como objetivo identificar e avaliar fatores de risco psicossocial no ambiente de trabalho, em conformidade com a NR-1.</p>
                <p>Suas respostas são <strong>completamente anônimas</strong>. Não é possível identificar individualmente os respondentes.</p>
                <p>Os dados coletados serão utilizados exclusivamente para análise estatística e elaboração de planos de ação para melhoria do ambiente de trabalho.</p>
                <p>A participação é voluntária e você pode interromper a pesquisa a qualquer momento.</p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="consent"
                  checked={consentAccepted}
                  onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                />
                <Label htmlFor="consent" className="text-sm cursor-pointer">
                  Li e aceito o termo de consentimento
                </Label>
              </div>
              <Button className="w-full" disabled={!consentAccepted} onClick={() => setStep('demographics')}>
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Demographics Step */}
        {step === 'demographics' && (
          <Card>
            <CardHeader>
              <CardTitle>Dados Demográficos</CardTitle>
              <CardDescription>Informações opcionais para análise estatística (não identificam você)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Gênero (opcional)</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Faixa Etária (opcional)</Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((a) => (
                      <SelectItem key={a} value={a}>{a} anos</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('consent')}>Voltar</Button>
                <Button className="flex-1" onClick={() => setStep('questions')}>
                  Iniciar Pesquisa
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questions Step */}
        {(step === 'questions' || step === 'submitting') && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{answeredCount} de {QUESTIONS.length} questões respondidas</span>
                <span>Página {currentPage + 1} de {totalPages}</span>
              </div>
              <Progress value={progress} />
            </div>

            {errorMsg && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            <Card>
              <CardContent className="pt-6 space-y-6">
                {currentQuestions.map((q) => (
                  <div key={q.id} className="space-y-3">
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground mr-2">{q.id}.</span>
                      {q.text}
                    </p>
                    <RadioGroup
                      value={responses[`q${q.id}`]?.toString() ?? ''}
                      onValueChange={(v) => {
                        setResponses((prev) => ({ ...prev, [`q${q.id}`]: parseInt(v) }));
                        setErrorMsg('');
                      }}
                      className="flex flex-wrap gap-2"
                    >
                      {LIKERT_SCALE.map((option) => (
                        <div key={option.value} className="flex items-center">
                          <RadioGroupItem value={option.value.toString()} id={`q${q.id}-${option.value}`} className="peer sr-only" />
                          <Label
                            htmlFor={`q${q.id}-${option.value}`}
                            className="cursor-pointer rounded-md border px-3 py-2 text-xs peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground hover:bg-muted transition-colors"
                          >
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              {currentPage > 0 && (
                <Button variant="outline" onClick={() => setCurrentPage((p) => p - 1)}>
                  Anterior
                </Button>
              )}
              <div className="flex-1" />
              {currentPage < totalPages - 1 ? (
                <Button onClick={() => setCurrentPage((p) => p + 1)}>
                  Próximo
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={step === 'submitting'}>
                  {step === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Respostas'
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
