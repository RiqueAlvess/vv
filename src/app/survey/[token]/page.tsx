'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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

interface HierarchyPosition { id: string; name: string; }
interface HierarchySector { id: string; name: string; positions: HierarchyPosition[]; }
interface HierarchyUnit { id: string; name: string; sectors: HierarchySector[]; }

type SurveyStep =
  | 'loading'
  | 'invalid'
  | 'cpf_verify'
  | 'cpf_verifying'
  | 'consent'
  | 'hierarchy'
  | 'demographics'
  | 'questions'
  | 'submitting'
  | 'done'
  | 'declined';

/** Format CPF input as 000.000.000-00 */
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
  const [hierarchy, setHierarchy] = useState<HierarchyUnit[]>([]);
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
    company_logo_url: string | null;
  } | null>(null);

  const questionsPerPage = 5;
  const totalPages = Math.ceil(QUESTIONS.length / questionsPerPage);
  const currentQuestions = QUESTIONS.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);
  const answeredCount = Object.keys(responses).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;

  const availableSectors = hierarchy.find(u => u.id === selectedUnitId)?.sectors ?? [];
  const availablePositions = availableSectors.find(s => s.id === selectedSectorId)?.positions ?? [];

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
            company_logo_url: data.company_logo_url ?? null,
          });
          setHierarchy(data.hierarchy ?? []);
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
      // Pre-populate hierarchy from CSV registration (user can still change)
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
        // Token expired — go back to CPF verification
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

  // ── Loading ──────────────────────────────────────────────────────────────
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

  // ── Invalid ───────────────────────────────────────────────────────────────
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
        <Card className="w-full max-w-lg text-center">
          <CardContent className="py-10 px-6">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: '#1AA278' }} />
            <h2 className="text-xl font-semibold mb-3">Obrigado por compartilhar suas respostas!</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Cuidar da saúde mental é tão importante quanto a física. Algumas dicas rápidas:
            </p>
            <ul className="text-sm text-muted-foreground text-left space-y-2 mb-2 mx-auto max-w-xs">
              <li className="flex items-start gap-2"><span className="mt-0.5">🌿</span> Faça pequenas pausas durante o dia</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">🚶</span> Movimente-se, mesmo que seja uma caminhada curta</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">💬</span> Converse com pessoas de confiança</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">😴</span> Priorize um sono de qualidade</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">🩺</span> Procure ajuda profissional quando precisar</li>
            </ul>
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
              Você optou por não participar desta pesquisa. Sua decisão foi registrada e nenhum dado foi coletado.
            </p>
            <p className="text-muted-foreground text-sm">
              Você pode fechar esta página.
            </p>
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
          <div className="flex items-center justify-center gap-4 mb-3">
            <Logo size={44} />
            {campaignInfo?.company_logo_url && (
              <>
                <span className="text-muted-foreground/40 text-xl">|</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={campaignInfo.company_logo_url}
                  alt={campaignInfo.company_name}
                  className="h-10 max-w-[140px] object-contain"
                />
              </>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold">Mapeamento de Riscos Psicossociais</h1>
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
                Sua participação é validada pelo CPF cadastrado pela sua empresa.
                Após a conclusão da pesquisa, seu CPF é <strong className="text-foreground">excluído permanentemente</strong> da base de dados — não é possível recuperá-lo.
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
                {campaignInfo?.company_logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={campaignInfo.company_logo_url}
                    alt={campaignInfo.company_name}
                    className="h-9 max-w-[100px] object-contain"
                  />
                )}
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
                  Prezado(a) colaborador(a), antes de iniciar o questionário, leia atentamente este termo.
                </p>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">1. Controlador e Operador</h3>
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Controlador:</strong>{' '}
                    {campaignInfo?.company_name ?? '[EMPRESA]'} (CNPJ{' '}
                    {campaignInfo?.company_cnpj ?? '[CNPJ]'}) — responsável pela decisão de realizar
                    esta pesquisa e pelo cumprimento da NR-1.{' '}
                    <strong className="text-foreground">Operador:</strong> Vivamente360 — plataforma
                    tecnológica que processa os dados em nome do Controlador, sem acesso a dados
                    identificados dos respondentes.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">2. Finalidade</h3>
                  <p className="text-muted-foreground">
                    Identificação e gestão de riscos psicossociais no trabalho, conforme obrigação da NR-1
                    (Portaria MTE nº 1.419/2024). O instrumento utilizado é o HSE-IT (35 questões,
                    7 dimensões). Os resultados são usados{' '}
                    <strong className="text-foreground">exclusivamente</strong> para diagnóstico
                    organizacional e elaboração do Programa de Gerenciamento de Riscos (PGR).{' '}
                    <strong className="text-foreground">
                      Não serão utilizados para avaliação de desempenho individual, processos
                      disciplinares ou qualquer decisão que afete sua relação de emprego.
                    </strong>
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">3. Como sua anonimidade é garantida</h3>
                  <p className="text-muted-foreground">
                    Seu CPF é usado <strong className="text-foreground">somente</strong> para confirmar
                    que você está cadastrado nesta campanha e garantir que cada colaborador responda
                    apenas uma vez. Ao concluir o envio, o CPF é{' '}
                    <strong className="text-foreground">excluído permanentemente e de forma irreversível</strong>{' '}
                    — não é possível recuperá-lo nem vincular qualquer resposta à sua identidade.
                    As respostas são gravadas sem nenhum campo identificável (sem nome, e-mail,
                    matrícula, IP ou localização). A unidade, o setor e o cargo são sugeridos com base
                    no cadastro fornecido pela empresa.{' '}
                    <strong className="text-foreground">Você pode confirmar ou alterar esses dados, mas eles não podem ficar em branco.</strong>{' '}
                    Os resultados são sempre apresentados de forma agregada —
                    nunca individualmente.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">4. Dados coletados</h3>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Respostas às 35 perguntas do questionário HSE-IT (escala 0–4)</li>
                    <li>
                      Unidade, setor e cargo (pré-preenchidos com base no cadastro e obrigatórios,
                      podendo ser ajustados por você para análise por área)
                    </li>
                    <li>Faixa etária e sexo (obrigatórios, para análise estatística agregada)</li>
                    <li>Data e hora do aceite deste termo (sem vínculo com sua identidade)</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    <strong className="text-foreground">Não será retido após a conclusão:</strong> CPF
                    (excluído imediatamente ao enviar), nome, e-mail, matrícula, endereço, telefone,
                    endereço IP ou qualquer outro dado que permita identificação individual.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">5. Base legal (LGPD)</h3>
                  <p className="text-muted-foreground">
                    Art. 7º, I — Consentimento livre e informado do titular.{' '}
                    Art. 7º, II — Cumprimento de obrigação legal (NR-1).{' '}
                    Art. 11, II, a — Proteção da vida e da saúde dos trabalhadores.
                    Lei nº 13.709/2018 (LGPD).
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">6. Retenção, voluntariedade e direitos</h3>
                  <p className="text-muted-foreground">
                    A participação é <strong className="text-foreground">completamente voluntária</strong> —
                    recusar ou interromper não acarreta qualquer consequência trabalhista. Os dados de
                    respostas são mantidos pelo prazo mínimo necessário ao cumprimento das obrigações
                    legais da NR-1 e eventual defesa em processos administrativos ou judiciais. Como os
                    dados são anonimizados após o envio, não é tecnicamente possível localizar ou excluir
                    respostas individuais. Dúvidas sobre privacidade podem ser encaminhadas ao RH da
                    empresa ou ao canal de privacidade da Vivamente360.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                  <p>Versão 3.0 · Conforme Lei nº 13.709/2018 (LGPD) e Portaria MTE nº 1.419/2024 (NR-1)</p>
                  <p className="mt-1">
                    Controlador: {campaignInfo?.company_name ?? '[EMPRESA]'} (CNPJ{' '}
                    {campaignInfo?.company_cnpj ?? '[CNPJ]'}) · Operador: Vivamente360
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" className="sm:flex-none" onClick={() => setStep('declined')}>
                  Não aceito — sair
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setErrorMsg('');
                    setStep('hierarchy');
                  }}
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
                Pré-preenchido com base no seu cadastro — confirme ou altere os campos obrigatórios (não identifica você individualmente)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Unidade <span className="text-destructive">*</span>
                </Label>
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
                <Label>
                  Setor <span className="text-destructive">*</span>
                </Label>
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
                <Label>
                  Cargo <span className="text-destructive">*</span>
                </Label>
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

              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (!selectedUnitId || !selectedSectorId || !selectedPositionId) {
                      setErrorMsg('Unidade, setor e cargo são obrigatórios para continuar');
                      return;
                    }
                    setErrorMsg('');
                    setStep('demographics');
                  }}
                >
                  Continuar →
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> Campos obrigatórios
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Demographics */}
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
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Faixa Etária <span className="text-destructive">*</span>
                </Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((a) => (
                      <SelectItem key={a} value={a}>{a} anos</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
              <div className="flex gap-2">
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
                  Iniciar Mapeamento →
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> Campos obrigatórios
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Questions */}
        {(step === 'questions' || step === 'submitting') && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{answeredCount} de {QUESTIONS.length} questões respondidas</span>
                <span className="text-muted-foreground">Pág. {currentPage + 1}/{totalPages}</span>
              </div>
              <Progress value={progress} />
            </div>

            {errorMsg && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            <Card className="border-2">
              <CardContent className="pt-4 sm:pt-6 space-y-0 px-3 sm:px-6">
                {currentQuestions.map((q, idx) => (
                  <div key={q.id} className={`space-y-3 py-5 ${idx < currentQuestions.length - 1 ? 'border-b border-border' : ''}`}>
                    <p className="text-sm font-medium leading-relaxed">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold mr-2 shrink-0">{q.id}</span>
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
                          <RadioGroupItem value={option.value.toString()} id={`q${q.id}-${option.value}`} className="peer sr-only" />
                          <Label
                            htmlFor={`q${q.id}-${option.value}`}
                            className="w-full cursor-pointer rounded-md border-2 border-border/70 px-3 py-2 text-xs text-center peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary hover:bg-muted hover:border-border transition-colors select-none"
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
