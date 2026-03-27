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
  { id: 1, text: 'Eu tenho clareza sobre o que é esperado de mim no trabalho' },
  { id: 2, text: 'Eu posso decidir quando fazer uma pausa' },
  { id: 3, text: 'Diferentes grupos no trabalho exigem coisas difíceis de conciliar' },
  { id: 4, text: 'Eu sei como fazer o meu trabalho' },
  { id: 5, text: 'Eu estou sujeito(a) a assédio pessoal na forma de palavras ou comportamentos cruéis' },
  { id: 6, text: 'Eu tenho prazos impossíveis de cumprir' },
  { id: 7, text: 'Se o trabalho fica difícil, meus colegas me ajudam' },
  { id: 8, text: 'Eu recebo feedback sobre o trabalho que realizo' },
  { id: 9, text: 'Eu tenho que trabalhar muito intensamente' },
  { id: 10, text: 'Eu tenho escolha sobre como fazer meu trabalho' },
  { id: 11, text: 'Eu entendo como meu trabalho se encaixa no objetivo geral da organização' },
  { id: 12, text: 'Eu sou pressionado(a) a trabalhar por longas horas' },
  { id: 13, text: 'Eu tenho oportunidade de usar minhas habilidades' },
  { id: 14, text: 'Existem atritos ou raiva entre os colegas' },
  { id: 15, text: 'Eu posso escolher o que fazer no meu trabalho' },
  { id: 16, text: 'Eu sou incapaz de fazer pausas suficientes' },
  { id: 17, text: 'Eu entendo meu papel e responsabilidades' },
  { id: 18, text: 'Eu tenho que negligenciar algumas tarefas porque tenho muito a fazer' },
  { id: 19, text: 'Eu tenho controle sobre meu ritmo de trabalho' },
  { id: 20, text: 'Eu recebo tarefas impossíveis de realizar' },
  { id: 21, text: 'Eu estou sujeito(a) a bullying no trabalho' },
  { id: 22, text: 'Eu não tenho tempo suficiente para fazer meu trabalho' },
  { id: 23, text: 'Eu posso contar com meu chefe caso tenha um problema no trabalho' },
  { id: 24, text: 'Eu recebo ajuda e suporte dos meus colegas' },
  { id: 25, text: 'Eu tenho alguma influência sobre como fazer meu trabalho' },
  { id: 26, text: 'Eu tenho oportunidades suficientes de questionar gestores sobre mudanças no trabalho' },
  { id: 27, text: 'Eu recebo o respeito que mereço dos meus colegas no trabalho' },
  { id: 28, text: 'Mudanças no trabalho são consultadas com os funcionários' },
  { id: 29, text: 'Eu posso conversar com meu chefe sobre algo que me chateou ou irritou no trabalho' },
  { id: 30, text: 'Meu horário de trabalho pode ser flexível' },
  { id: 31, text: 'Meus colegas estão dispostos a me ouvir quando tenho problemas no trabalho' },
  { id: 32, text: 'Quando mudanças são feitas no trabalho, fico claro como elas vão funcionar na prática' },
  { id: 33, text: 'Eu sou apoiado(a) em trabalhos emocionalmente exigentes' },
  { id: 34, text: 'Os relacionamentos no trabalho são tensos' },
  { id: 35, text: 'Meu chefe me encoraja no trabalho' },
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
