'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowLeft, ArrowRight, CheckCircle2, Clock, Lock } from 'lucide-react';
import { LIKERT_SCALE, AGE_RANGES, GENDER_OPTIONS } from '@/lib/constants';

const QUESTIONS = [
  { id: 1,  text: 'Tenho clareza sobre o que se espera do meu trabalho' },
  { id: 2,  text: 'Posso decidir quando fazer uma pausa' },
  { id: 3,  text: 'As exigências de trabalho feitas por colegas e supervisores são difíceis de combinar' },
  { id: 4,  text: 'Eu sei como fazer o meu trabalho' },
  { id: 5,  text: 'Falam ou se comportam comigo de forma dura' },
  { id: 6,  text: 'Tenho prazos inatingíveis' },
  { id: 7,  text: 'Quando o trabalho se torna difícil, posso contar com ajuda dos colegas' },
  { id: 8,  text: 'Recebo informações e suporte que me ajudam no trabalho que eu faço' },
  { id: 9,  text: 'Devo trabalhar muito intensamente' },
  { id: 10, text: 'Consideram a minha opinião sobre a velocidade do meu trabalho' },
  { id: 11, text: 'Estão claras as minhas tarefas e responsabilidades' },
  { id: 12, text: 'Eu não faço algumas tarefas porque tenho muita coisa para fazer' },
  { id: 13, text: 'Os objetivos e metas do meu setor são claros para mim' },
  { id: 14, text: 'Existem conflitos entre os colegas' },
  { id: 15, text: 'Tenho liberdade de escolha de como fazer meu trabalho' },
  { id: 16, text: 'Não tenho possibilidade de fazer pausas suficientes' },
  { id: 17, text: 'Eu vejo como o meu trabalho se encaixa nos objetivos da empresa' },
  { id: 18, text: 'Recebo pressão para trabalhar em outro horário' },
  { id: 19, text: 'Tenho liberdade de escolha para decidir o que fazer no meu trabalho' },
  { id: 20, text: 'Tenho que fazer meu trabalho com muita rapidez' },
  { id: 21, text: 'Sinto que sou perseguido no trabalho' },
  { id: 22, text: 'As pausas temporárias são impossíveis de cumprir' },
  { id: 23, text: 'Posso confiar no meu chefe quando eu tiver problemas no trabalho' },
  { id: 24, text: 'Meus colegas me ajudam e me dão apoio quando eu preciso' },
  { id: 25, text: 'Minhas sugestões são consideradas sobre como fazer meu trabalho' },
  { id: 26, text: 'Tenho oportunidades para pedir explicações ao chefe sobre as mudanças relacionadas ao meu trabalho' },
  { id: 27, text: 'No trabalho os meus colegas demonstram o respeito que mereço' },
  { id: 28, text: 'As pessoas são sempre consultadas sobre as mudanças no trabalho' },
  { id: 29, text: 'Quando algo no trabalho me perturba ou irrita posso falar com meu chefe' },
  { id: 30, text: 'O meu horário de trabalho pode ser flexível' },
  { id: 31, text: 'Os colegas estão disponíveis para escutar os meus problemas de trabalho' },
  { id: 32, text: 'Quando há mudanças, faço o meu trabalho com o mesmo carinho' },
  { id: 33, text: 'Tenho suportado trabalhos emocionalmente exigentes' },
  { id: 34, text: 'As relações no trabalho são tensas' },
  { id: 35, text: 'Meu chefe me incentiva no trabalho' },
] as const;

const QUESTIONS_PER_PAGE = 5;
const TOTAL_PAGES = Math.ceil(QUESTIONS.length / QUESTIONS_PER_PAGE);

type Step = 'welcome' | 'demographics' | 'questions' | 'submitting';

export default function TrialSurveyPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('welcome');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [invalidIds, setInvalidIds] = useState<Set<number>>(new Set());

  const currentQuestions = QUESTIONS.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE,
  );
  const answeredCount = Object.keys(responses).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;

  const handleFinish = useCallback(async () => {
    setStep('submitting');
    try {
      localStorage.setItem('trial_responses', JSON.stringify(responses));
      localStorage.setItem('trial_demographics', JSON.stringify({ gender, ageRange }));
      localStorage.setItem('trial_completed_at', new Date().toISOString());
    } catch {
      // localStorage may be unavailable — pass data via sessionStorage
      sessionStorage.setItem('trial_responses', JSON.stringify(responses));
    }
    router.push('/trial/results');
  }, [responses, gender, ageRange, router]);

  const advancePage = useCallback(() => {
    const unanswered = currentQuestions
      .filter((q) => responses[`q${q.id}`] === undefined)
      .map((q) => q.id);

    if (unanswered.length > 0) {
      setInvalidIds(new Set(unanswered));
      return;
    }
    setInvalidIds(new Set());

    if (currentPage < TOTAL_PAGES - 1) {
      setCurrentPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleFinish();
    }
  }, [currentQuestions, responses, currentPage, handleFinish]);

  return (
    <div className="min-h-screen bg-[#f8fafb]">

      {/* ── Nav bar ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div
            className="rounded px-3 py-1.5 text-white text-sm font-bold"
            style={{ background: '#144660' }}
          >
            VIVAMENTE360
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" style={{ color: '#1AA278' }} />
            <span className="hidden sm:inline">Mapeamento Anônimo</span>
            <Badge variant="secondary" className="text-xs">Demo</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── STEP: Welcome ────────────────────────────────────────────── */}
        {step === 'welcome' && (
          <Card className="border-2 overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #144660, #1ff28d)' }} />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl p-2.5" style={{ background: 'rgba(20,70,96,0.08)' }}>
                  <Clock className="h-5 w-5" style={{ color: '#144660' }} />
                </div>
                <div>
                  <CardTitle className="text-lg">Mapeamento de Riscos Psicossociais</CardTitle>
                  <CardDescription>Instrumento HSE-IT · NR-1 · 35 questões · ~8 minutos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-3 leading-relaxed">
                <p className="text-muted-foreground">
                  Este questionário avalia sete dimensões psicossociais do seu ambiente de trabalho —
                  Demandas, Controle, Apoio da Chefia, Apoio dos Colegas, Relacionamentos, Cargo/Função e Comunicação.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Não existem respostas certas ou erradas.</strong>{' '}
                  O importante é a sua percepção real do cotidiano.
                </p>
                <div className="pt-1 space-y-2">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" style={{ color: '#1AA278' }} />
                    Sua privacidade está 100% protegida
                  </h3>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
                    <li>Nenhuma informação pessoal é solicitada ou armazenada</li>
                    <li>Tecnologia Blind-Drop™ — respostas sem vínculo de identidade</li>
                    <li>Dados desta demo são processados apenas localmente</li>
                  </ul>
                </div>
              </div>

              <Button
                className="w-full py-5 text-base font-semibold gap-2"
                style={{ background: '#144660' }}
                onClick={() => setStep('demographics')}
              >
                Começar Mapeamento
                <ArrowRight className="h-4 w-4" />
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                <Link href="/trial" className="hover:underline">← Voltar para a página inicial</Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── STEP: Demographics ───────────────────────────────────────── */}
        {step === 'demographics' && (
          <Card>
            <CardHeader>
              <CardTitle>Dados Demográficos</CardTitle>
              <CardDescription>
                Usados apenas para análise estatística agregada — não identificam você
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Gênero <span className="text-destructive">*</span></Label>
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
                <Label>Faixa Etária <span className="text-destructive">*</span></Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((a) => (
                      <SelectItem key={a} value={a}>{a} anos</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('welcome')}>
                  <ArrowLeft className="h-4 w-4 mr-1" />Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!gender || !ageRange}
                  onClick={() => { setStep('questions'); window.scrollTo({ top: 0 }); }}
                  style={{ background: '#144660' }}
                >
                  Iniciar Questionário →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP: Questions ──────────────────────────────────────────── */}
        {(step === 'questions' || step === 'submitting') && (
          <>
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {answeredCount} de {QUESTIONS.length} questões respondidas
                </span>
                <span className="font-medium text-[#144660]">
                  Página {currentPage + 1} de {TOTAL_PAGES}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Questions card */}
            <Card className="border-2">
              <CardContent className="pt-5 px-4 sm:px-6 space-y-0">
                {currentQuestions.map((q, idx) => {
                  const isInvalid = invalidIds.has(q.id);
                  return (
                    <div
                      key={q.id}
                      className={[
                        'space-y-3 py-5 transition-colors',
                        idx < currentQuestions.length - 1 ? 'border-b-2 border-gray-100' : '',
                        isInvalid ? 'border-l-4 border-l-destructive pl-4 -ml-4' : '',
                      ].join(' ')}
                    >
                      <p className="text-sm font-medium leading-relaxed">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-2 shrink-0 ${
                            isInvalid
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {q.id}
                        </span>
                        {q.text}
                        {isInvalid && (
                          <span className="ml-2 text-xs font-normal text-destructive"> — obrigatório</span>
                        )}
                      </p>
                      <RadioGroup
                        value={responses[`q${q.id}`]?.toString() ?? ''}
                        onValueChange={(v) => {
                          setResponses((prev) => ({ ...prev, [`q${q.id}`]: parseInt(v) }));
                          setInvalidIds((prev) => {
                            if (!prev.has(q.id)) return prev;
                            const next = new Set(prev);
                            next.delete(q.id);
                            return next;
                          });
                        }}
                        className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2"
                      >
                        {LIKERT_SCALE.map((option) => (
                          <div key={option.value} className="flex items-center">
                            <RadioGroupItem
                              value={option.value.toString()}
                              id={`q${q.id}-${option.value}`}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={`q${q.id}-${option.value}`}
                              className={[
                                'w-full cursor-pointer rounded-md border-2 px-3 py-2 text-xs text-center',
                                'peer-data-[state=checked]:bg-[#144660] peer-data-[state=checked]:text-white peer-data-[state=checked]:border-[#144660]',
                                'hover:bg-muted hover:border-gray-400 transition-colors select-none',
                                isInvalid ? 'border-destructive/40' : 'border-gray-200',
                              ].join(' ')}
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentPage > 0 && (
                <Button
                  variant="outline"
                  onClick={() => { setCurrentPage((p) => p - 1); window.scrollTo({ top: 0 }); }}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />Anterior
                </Button>
              )}
              <div className="flex-1" />
              <Button
                onClick={advancePage}
                disabled={step === 'submitting'}
                style={{ background: '#144660' }}
                className="gap-2"
              >
                {step === 'submitting' ? (
                  'Processando...'
                ) : currentPage < TOTAL_PAGES - 1 ? (
                  <>Próximo <ArrowRight className="h-4 w-4" /></>
                ) : (
                  <>Ver Meu Resultado <CheckCircle2 className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
