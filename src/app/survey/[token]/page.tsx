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
  const [campaignInfo, setCampaignInfo] = useState<{
    campaign_name: string;
    company_name: string;
    company_cnpj: string;
  } | null>(null);

  const questionsPerPage = 5;
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
          setCampaignInfo({
            campaign_name: data.campaign_name ?? '',
            company_name: data.company_name ?? '',
            company_cnpj: data.company_cnpj ?? '',
          });
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
          {campaignInfo && (
            <p className="text-sm text-muted-foreground mt-1">
              {campaignInfo.company_name} — {campaignInfo.campaign_name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Instrumento HSE-IT · NR-1</p>
        </div>

        {/* Consent Step */}
        {step === 'consent' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Termo de Consentimento Livre e Esclarecido</CardTitle>
                  <CardDescription>
                    Em conformidade com a LGPD (Lei nº 13.709/2018) e NR-1 (Portaria MTE nº 1.419/2024)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-96 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm space-y-4 leading-relaxed">
                <p className="text-muted-foreground">
                  Prezado(a) colaborador(a), antes de iniciar o questionário, pedimos que leia atentamente este termo.
                </p>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">1. Quem está conduzindo esta pesquisa</h3>
                  <p className="text-muted-foreground">
                    Esta pesquisa é conduzida pela empresa{' '}
                    <strong className="text-foreground">{campaignInfo?.company_name ?? '[EMPRESA]'}</strong>,
                    inscrita sob CNPJ{' '}
                    <strong className="text-foreground">{campaignInfo?.company_cnpj ?? '[CNPJ]'}</strong>,
                    como parte do cumprimento das obrigações da NR-1, que exige a identificação e gestão de
                    riscos psicossociais no ambiente de trabalho. A plataforma utilizada é o{' '}
                    <strong className="text-foreground">Asta</strong>, que opera como operador de dados nos
                    termos do artigo 5º, inciso VII da LGPD.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">2. Por que esta pesquisa está sendo realizada</h3>
                  <p className="text-muted-foreground">
                    A NR-1, com as alterações introduzidas pela Portaria MTE nº 1.419/2024, tornou obrigatório
                    que as empresas identifiquem os riscos psicossociais presentes no ambiente de trabalho. Esta
                    pesquisa utiliza o instrumento HSE-IT, composto por 35 questões organizadas em 7 dimensões:
                    Demandas, Controle, Apoio da Chefia, Apoio dos Colegas, Relacionamentos, Cargo e Comunicação
                    e Mudanças. Os resultados serão usados exclusivamente para elaborar relatórios de diagnóstico
                    e planos de ação para compliance com a NR-1.{' '}
                    <strong className="text-foreground">
                      Não serão usados para avaliação de desempenho individual ou processos disciplinares.
                    </strong>
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">3. Como sua anonimidade é garantida</h3>
                  <p className="text-muted-foreground">
                    Este sistema foi construído com uma arquitetura chamada{' '}
                    <strong className="text-foreground">Blind-Drop</strong>, que torna sua participação
                    estruturalmente anônima — não apenas por política, mas por{' '}
                    <strong className="text-foreground">impossibilidade técnica de vinculação</strong>. O convite
                    que você recebeu e a resposta que você vai enviar são armazenados em locais completamente
                    separados no banco de dados, sem nenhum campo em comum entre eles. Nem o RH, nem a TI, nem
                    os administradores da plataforma conseguem descobrir quem respondeu o quê. O link recebido é
                    invalidado com atraso aleatório após a sua resposta, impedindo correlação temporal.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    <strong className="text-foreground">Seu cargo não é coletado</strong> junto com suas
                    respostas — decisão arquitetural deliberada. Resultados de grupos com menos de 5 respondentes
                    nunca são exibidos, mesmo de forma agregada.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">4. O que será coletado</h3>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Respostas às 35 perguntas do questionário HSE-IT</li>
                    <li>Faixa etária e gênero (opcionais, para análise estatística agregada)</li>
                    <li>Registro do aceite deste termo (data/hora, sem vínculo com identidade)</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    <strong className="text-foreground">Não será coletado:</strong> nome, e-mail, CPF, matrícula,
                    cargo, endereço, telefone, localização, IP ou qualquer dado que permita identificação
                    individual.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">5. Base legal</h3>
                  <p className="text-muted-foreground">
                    Art. 7º, I (Consentimento) · Art. 7º, II (Obrigação legal — NR-1) · Art. 11, II, a
                    (Proteção da saúde) da Lei nº 13.709/2018 (LGPD).
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">6. Seus direitos como titular</h3>
                  <p className="text-muted-foreground">
                    Conforme o art. 18 da LGPD: confirmar tratamento, acessar dados, solicitar correção,
                    eliminação, portabilidade, revogar consentimento, opor-se ao tratamento e reclamar perante
                    a ANPD. Contato: canais de comunicação interna da{' '}
                    {campaignInfo?.company_name ?? 'empresa'}.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">7. Retenção e voluntariedade</h3>
                  <p className="text-muted-foreground">
                    Dados mantidos pelo período necessário à análise e elaboração dos relatórios NR-1, após o
                    que serão eliminados ou anonimizados (art. 15 LGPD). Participação{' '}
                    <strong className="text-foreground">completamente voluntária</strong> — recusar ou
                    interromper não acarreta qualquer consequência trabalhista ou disciplinar.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                  <p>
                    Versão 2.0 · Conforme Lei nº 13.709/2018 (LGPD) e Portaria MTE nº 1.419/2024 (NR-1)
                  </p>
                  <p className="mt-1">
                    Controlador: {campaignInfo?.company_name ?? '[EMPRESA]'} — CNPJ:{' '}
                    {campaignInfo?.company_cnpj ?? '[CNPJ]'} · Operador: Asta
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="consent"
                  checked={consentAccepted}
                  onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-sm cursor-pointer leading-relaxed">
                  Li e compreendi todas as informações deste termo. Participo voluntariamente e autorizo o
                  tratamento dos meus dados conforme descrito acima. Estou ciente de que minha identidade
                  não será revelada em nenhuma circunstância, por garantia técnica.
                </Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    window.close();
                  }}
                >
                  Não aceito — sair
                </Button>
                <Button
                  className="flex-1"
                  disabled={!consentAccepted}
                  onClick={() => setStep('demographics')}
                >
                  Aceito e desejo participar →
                </Button>
              </div>
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
