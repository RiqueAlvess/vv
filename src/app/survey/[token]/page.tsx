'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
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

interface HierarchyPosition { id: string; name: string; }
interface HierarchySector { id: string; name: string; positions: HierarchyPosition[]; }
interface HierarchyUnit { id: string; name: string; sectors: HierarchySector[]; }

type SurveyStep =
  | 'loading'
  | 'invalid'
  | 'already_responded'
  | 'consent'
  | 'hierarchy'
  | 'demographics'
  | 'questions'
  | 'submitting'
  | 'done';

// ── Device fingerprinting ────────────────────────────────────────────────────
async function generateFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Asta🔒', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Asta🔒', 4, 17);
    }
    const canvasHash = canvas.toDataURL();

    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency ?? 0,
      canvasHash.slice(0, 200),
    ].join('|');

    // SHA-256 via SubtleCrypto
    const encoded = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: random ID stored in sessionStorage (weaker but won't break flow)
    const key = 'asta_fp';
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const fallback = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, fallback);
    return fallback;
  }
}

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<SurveyStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchyUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [fingerprint, setFingerprint] = useState('');
  const [campaignId, setCampaignId] = useState('');
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

  const availableSectors = hierarchy.find(u => u.id === selectedUnitId)?.sectors ?? [];
  const availablePositions = availableSectors.find(s => s.id === selectedSectorId)?.positions ?? [];

  // Generate fingerprint on mount
  useEffect(() => {
    generateFingerprint().then(setFingerprint);
  }, []);

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`/api/survey/${token}`);
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setErrorMsg(data.error || 'QR Code inválido');
          setStep('invalid');
        } else {
          const cid = data.campaign_id as string;
          setCampaignId(cid);
          // localStorage barrier — soft device-level deduplication
          if (typeof window !== 'undefined' && localStorage.getItem(`vivamente_responded_${cid}`)) {
            setStep('already_responded');
            return;
          }
          setCampaignInfo({
            campaign_name: data.campaign_name ?? '',
            company_name: data.company_name ?? '',
            company_cnpj: data.company_cnpj ?? '',
          });
          setHierarchy(data.hierarchy ?? []);
          setStep('consent');
        }
      } catch {
        setErrorMsg('Erro ao validar QR Code');
        setStep('invalid');
      }
    };
    validate();
  }, [token]);

  const handleSubmit = useCallback(async () => {
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
          unit_id: selectedUnitId || undefined,
          sector_id: selectedSectorId || undefined,
          position_id: selectedPositionId || undefined,
          fingerprint: fingerprint || undefined,
          consent_accepted: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.error?.includes('já participou')) {
          setStep('already_responded');
          return;
        }
        setErrorMsg(data.error || 'Erro ao enviar respostas');
        setStep('questions');
        return;
      }

      // Mark this device as responded in localStorage
      if (typeof window !== 'undefined' && campaignId) {
        localStorage.setItem(`vivamente_responded_${campaignId}`, '1');
      }
      setStep('done');
    } catch {
      setErrorMsg('Erro de conexão');
      setStep('questions');
    }
  }, [answeredCount, token, responses, gender, ageRange, selectedUnitId, selectedSectorId, selectedPositionId, fingerprint, campaignId]);

  // ── Loading ──────────────────────────────────────────────────────────────
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

  // ── Invalid / already responded / done ───────────────────────────────────
  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">QR Code Inválido</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'already_responded') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Participação Registrada</h2>
            <p className="text-muted-foreground">
              Este dispositivo já participou desta pesquisa. Obrigado pela sua contribuição!
            </p>
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
            <Logo size={44} />
          </div>
          <h1 className="text-xl font-bold">Pesquisa de Riscos Psicossociais</h1>
          {campaignInfo && (
            <p className="text-sm text-muted-foreground mt-1">
              {campaignInfo.company_name} — {campaignInfo.campaign_name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Instrumento HSE-IT · NR-1</p>
        </div>

        {/* Step 1: Consent */}
        {step === 'consent' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Logo size={40} />
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
                    como parte do cumprimento das obrigações da NR-1. A plataforma utilizada é o{' '}
                    <strong className="text-foreground">Vivamente360</strong>.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">2. Por que esta pesquisa está sendo realizada</h3>
                  <p className="text-muted-foreground">
                    A NR-1 tornou obrigatório que as empresas identifiquem os riscos psicossociais. Esta pesquisa
                    utiliza o instrumento HSE-IT (35 questões, 7 dimensões). Os resultados serão usados
                    exclusivamente para diagnóstico e planos de ação.{' '}
                    <strong className="text-foreground">
                      Não serão usados para avaliação de desempenho individual ou processos disciplinares.
                    </strong>
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">3. Como sua anonimidade é garantida</h3>
                  <p className="text-muted-foreground">
                    A pesquisa é acessada via QR Code compartilhado — não há nenhum link individual que
                    identifique você. As respostas são armazenadas sem nenhum dado pessoal identificável.
                    A seleção de unidade, setor e cargo é{' '}
                    <strong className="text-foreground">feita por você</strong>, não capturada do sistema.
                    O resultado final é sempre apresentado de forma agregada.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">4. O que será coletado</h3>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Respostas às 35 perguntas do questionário HSE-IT</li>
                    <li>Unidade, setor e cargo (selecionados por você, opcionais)</li>
                    <li>Faixa etária e gênero (opcionais, para análise estatística agregada)</li>
                    <li>Registro do aceite deste termo (data/hora, sem vínculo com identidade)</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    <strong className="text-foreground">Não será coletado:</strong> nome, e-mail, CPF, matrícula,
                    endereço, telefone, localização, IP ou qualquer dado que permita identificação individual.
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
                  <h3 className="font-semibold text-foreground">6. Retenção e voluntariedade</h3>
                  <p className="text-muted-foreground">
                    Participação <strong className="text-foreground">completamente voluntária</strong> — recusar
                    não acarreta qualquer consequência trabalhista. Dados mantidos pelo período necessário à análise.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                  <p>Versão 2.0 · Conforme Lei nº 13.709/2018 (LGPD) e Portaria MTE nº 1.419/2024 (NR-1)</p>
                  <p className="mt-1">
                    Controlador: {campaignInfo?.company_name ?? '[EMPRESA]'} · Operador: Vivamente360
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
                  tratamento dos meus dados conforme descrito acima.
                </Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => window.close()}>
                  Não aceito — sair
                </Button>
                <Button
                  className="flex-1"
                  disabled={!consentAccepted}
                  onClick={() => setStep('hierarchy')}
                >
                  Aceito e desejo participar →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Hierarchy selection */}
        {step === 'hierarchy' && (
          <Card>
            <CardHeader>
              <CardTitle>Identificação Hierárquica</CardTitle>
              <CardDescription>
                Selecione sua unidade, setor e cargo para análise por área (opcional — não identifica você)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={selectedUnitId}
                  onValueChange={(v) => {
                    setSelectedUnitId(v);
                    setSelectedSectorId('');
                    setSelectedPositionId('');
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    {hierarchy.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Setor</Label>
                <Select
                  value={selectedSectorId}
                  onValueChange={(v) => {
                    setSelectedSectorId(v);
                    setSelectedPositionId('');
                  }}
                  disabled={!selectedUnitId}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {availableSectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select
                  value={selectedPositionId}
                  onValueChange={setSelectedPositionId}
                  disabled={!selectedSectorId}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                  <SelectContent>
                    {availablePositions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('consent')}>Voltar</Button>
                <Button className="flex-1" onClick={() => setStep('demographics')}>
                  Continuar →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Demographics */}
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
                <Button variant="outline" onClick={() => setStep('hierarchy')}>Voltar</Button>
                <Button className="flex-1" onClick={() => setStep('questions')}>
                  Iniciar Pesquisa →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Questions */}
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
