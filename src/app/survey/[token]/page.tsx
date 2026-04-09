'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertCircle, Loader2, Lock } from 'lucide-react';
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

type SurveyStep =
  | 'loading'
  | 'invalid'
  | 'cpf_verify'
  | 'cpf_verifying'
  | 'consent'
  | 'demographics'
  | 'questions'
  | 'submitting'
  | 'done'
  | 'declined';

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<SurveyStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  const [validationToken, setValidationToken] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');
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
  const currentQuestions = QUESTIONS.slice(
    currentPage * questionsPerPage,
    (currentPage + 1) * questionsPerPage,
  );
  const answeredCount = Object.keys(responses).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`/api/survey/${token}`);
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setErrorMsg(data.error || 'QR Code inválido');
          setStep('invalid');
        } else {
          setCampaignInfo({
            campaign_name: data.campaign_name ?? '',
            company_name: data.company_name ?? '',
            company_cnpj: data.company_cnpj ?? '',
          });
          setStep('cpf_verify');
        }
      } catch {
        setErrorMsg('Erro ao validar QR Code');
        setStep('invalid');
      }
    };
    validate();
  }, [token]);

  const handleCpfVerify = useCallback(async () => {
    const digits = cpfInput.replace(/\D/g, '');
    if (digits.length !== 11) {
      setErrorMsg('Digite um CPF válido com 11 dígitos');
      return;
    }
    setErrorMsg('');
    setStep('cpf_verifying');
    try {
      const res = await fetch(`/api/survey/${token}/validate-cpf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'CPF inválido');
        setStep('cpf_verify');
        return;
      }
      setValidationToken(data.validation_token);
      if (data.suggested_unit_id) setSelectedUnitId(data.suggested_unit_id);
      if (data.suggested_sector_id) setSelectedSectorId(data.suggested_sector_id);
      if (data.suggested_position_id) setSelectedPositionId(data.suggested_position_id);
      setStep('consent');
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
      setStep('cpf_verify');
    }
  }, [cpfInput, token]);

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
          gender,
          age_range: ageRange,
          unit_id: selectedUnitId,
          sector_id: selectedSectorId,
          position_id: selectedPositionId,
          validation_token: validationToken,
          consent_accepted: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Erro ao enviar respostas');
        if (res.status === 401) {
          setValidationToken('');
          setCpfInput('');
          setStep('cpf_verify');
        } else {
          setStep('questions');
        }
        return;
      }
      setStep('done');
    } catch {
      setErrorMsg('Erro de conexão');
      setStep('questions');
    }
  }, [answeredCount, token, responses, gender, ageRange, selectedUnitId, selectedSectorId, selectedPositionId, validationToken]);

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
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
            <h2 className="text-xl font-semibold mb-2">QR Code Inválido</h2>
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
            <p className="text-muted-foreground">
              Sua resposta foi registrada com sucesso. Você pode fechar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12 space-y-3">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Participação recusada</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Você optou por não participar desta pesquisa. Sua decisão foi registrada e nenhum dado
              foi coletado.
            </p>
            <p className="text-muted-foreground text-sm">Você pode fechar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 p-3 sm:p-4">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="text-center py-3 sm:py-4">
          <div className="flex justify-center mb-3">
            <Logo size={44} />
          </div>
          <h1 className="text-lg sm:text-xl font-bold">Pesquisa de Riscos Psicossociais</h1>
          {campaignInfo && (
            <p className="text-sm text-muted-foreground mt-1">
              {campaignInfo.company_name} — {campaignInfo.campaign_name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Instrumento HSE-IT · NR-1</p>
        </div>

        {/* Step 0: CPF Verification */}
        {(step === 'cpf_verify' || step === 'cpf_verifying') && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Chave de Acesso</CardTitle>
                  <CardDescription>Digite seu CPF para acessar a pesquisa</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sua participação é validada pelo CPF cadastrado pela sua empresa. Após a conclusão da
                pesquisa, seu CPF é{' '}
                <strong className="text-foreground">excluído permanentemente</strong> da base de dados
                — não é possível recuperá-lo.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpfInput}
                  onChange={(e) => {
                    setCpfInput(formatCpf(e.target.value));
                    setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && step !== 'cpf_verifying') handleCpfVerify();
                  }}
                  disabled={step === 'cpf_verifying'}
                  className="text-lg tracking-widest font-mono"
                  maxLength={14}
                  autoComplete="off"
                />
              </div>
              {errorMsg && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMsg}
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleCpfVerify}
                disabled={step === 'cpf_verifying' || cpfInput.replace(/\D/g, '').length !== 11}
              >
                {step === 'cpf_verifying' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  'Acessar Pesquisa →'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Consent */}
        {step === 'consent' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Logo size={40} />
                <div>
                  <CardTitle>Termo de Participação</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-4 leading-relaxed">
                <p className="text-muted-foreground">
                  Esta pesquisa faz parte de uma iniciativa para melhorar o ambiente de trabalho e
                  promover mais saúde e bem-estar para todos.
                </p>
                <p className="text-muted-foreground">
                  O questionário é simples e rápido, com 35 perguntas sobre o seu dia a dia no
                  trabalho, como organização das atividades, comunicação e apoio. Não existem respostas
                  certas ou erradas — o importante é sua percepção.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Sua participação é muito importante</strong> —
                  quanto mais pessoas responderem, mais efetivas serão as melhorias.
                </p>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Sua privacidade está protegida</h3>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Questionário é anonimizado</li>
                    <li>
                      Seu CPF será usado apenas para liberar o acesso e evitar respostas duplicadas
                    </li>
                    <li>Após o envio, ele é excluído definitivamente</li>
                    <li>As respostas são analisadas apenas de forma coletiva, nunca individual</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">
                    Os resultados serão utilizados exclusivamente para:
                  </h3>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Identificar oportunidades de melhoria no ambiente de trabalho</li>
                    <li>Promover ações de saúde e bem-estar</li>
                    <li>Atender às exigências legais</li>
                  </ul>
                </div>
                <p className="text-muted-foreground">
                  Ao continuar, você concorda em participar da pesquisa e contribuir para a construção
                  de um ambiente de trabalho melhor para todos!
                </p>
              </div>

              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="consent"
                  checked={consentAccepted}
                  onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-sm cursor-pointer leading-relaxed">
                  Concordo em participar da pesquisa.
                </Label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  className="sm:flex-none"
                  onClick={() => setStep('declined')}
                >
                  Não aceito — sair
                </Button>
                <Button
                  className="flex-1"
                  disabled={!consentAccepted}
                  onClick={() => {
                    setErrorMsg('');
                    setStep('demographics');
                  }}
                >
                  Aceito e desejo participar →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Demographics */}
        {step === 'demographics' && (
          <Card>
            <CardHeader>
              <CardTitle>Dados Demográficos</CardTitle>
              <CardDescription>
                Informações para análise estatística agregada — não identificam você individualmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Sexo <span className="text-destructive">*</span>
                </Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Faixa Etária <span className="text-destructive">*</span>
                </Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a} anos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setErrorMsg('');
                    setStep('consent');
                  }}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!gender || !ageRange}
                  onClick={() => {
                    if (!gender || !ageRange) {
                      setErrorMsg('Selecione sexo e faixa etária para continuar');
                      return;
                    }
                    setErrorMsg('');
                    setStep('questions');
                  }}
                >
                  Iniciar Pesquisa →
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> Campos obrigatórios
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Questions */}
        {(step === 'questions' || step === 'submitting') && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {answeredCount} de {QUESTIONS.length} questões respondidas
                </span>
                <span className="text-muted-foreground">
                  Pág. {currentPage + 1}/{totalPages}
                </span>
              </div>
              <Progress value={progress} />
            </div>

            {errorMsg && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            <Card>
              <CardContent className="pt-4 sm:pt-6 space-y-5 sm:space-y-6 px-3 sm:px-6">
                {currentQuestions.map((q) => (
                  <div key={q.id} className="space-y-3">
                    <p className="text-sm font-medium leading-relaxed">
                      <span className="text-muted-foreground mr-2">{q.id}.</span>
                      {q.text}
                    </p>
                    <RadioGroup
                      value={responses[`q${q.id}`]?.toString() ?? ''}
                      onValueChange={(v) => {
                        setResponses((prev) => ({ ...prev, [`q${q.id}`]: parseInt(v) }));
                        setErrorMsg('');
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
                            className="w-full cursor-pointer rounded-md border px-3 py-2 text-xs text-center peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground hover:bg-muted transition-colors select-none"
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
                <Button onClick={() => setCurrentPage((p) => p + 1)}>Próximo</Button>
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
