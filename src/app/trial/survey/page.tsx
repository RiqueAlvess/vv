'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Shield, Lock } from 'lucide-react';
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

const PER_PAGE = 5;
const TOTAL_PAGES = Math.ceil(QUESTIONS.length / PER_PAGE);

type Step = 'welcome' | 'demographics' | 'questions' | 'submitting';

export default function TrialSurveyPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('welcome');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [invalidIds, setInvalidIds] = useState<Set<number>>(new Set());

  const currentQs = QUESTIONS.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const answered = Object.keys(responses).length;
  const progress = answered / QUESTIONS.length;

  const finish = useCallback(async () => {
    setStep('submitting');
    try { localStorage.setItem('trial_responses', JSON.stringify(responses)); } catch { /* noop */ }
    try { sessionStorage.setItem('trial_responses', JSON.stringify(responses)); } catch { /* noop */ }
    router.push('/trial/results');
  }, [responses, router]);

  const advance = useCallback(() => {
    const missing = currentQs.filter((q) => responses[`q${q.id}`] === undefined).map((q) => q.id);
    if (missing.length) { setInvalidIds(new Set(missing)); return; }
    setInvalidIds(new Set());
    if (page < TOTAL_PAGES - 1) {
      setPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      finish();
    }
  }, [currentQs, responses, page, finish]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
      `}</style>

      {/* ── Minimal top bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <Link href="/trial">
          <Logo size={28} variant="dark" />
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" style={{ color: '#1AA278' }} />
          <span>Anônimo e seguro</span>
        </div>
      </div>

      {/* ── Progress bar (questions only) ────────────────────────────────── */}
      {step === 'questions' || step === 'submitting' ? (
        <div className="h-0.5 bg-gray-100">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress * 100}%`, background: '#1ff28d' }}
          />
        </div>
      ) : null}

      <div className="flex-1 flex items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-xl">

          {/* ── WELCOME ────────────────────────────────────────────────── */}
          {step === 'welcome' && (
            <div className="fade-up space-y-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a3d] mb-2">
                  Mapeamento de Riscos Psicossociais
                </h1>
                <p className="text-sm text-muted-foreground">
                  Instrumento HSE-IT · NR-1 · 35 questões · ~8 minutos
                </p>
              </div>

              <p className="text-[#0d2a3d]/75 leading-relaxed">
                Este questionário avalia sete dimensões psicossociais do seu ambiente de trabalho —
                Demandas, Controle, Apoio da Chefia, Apoio dos Colegas, Relacionamentos, Cargo/Função e Comunicação.
              </p>

              <p className="text-[#0d2a3d]/75 leading-relaxed">
                <strong className="text-[#0d2a3d]">Não existem respostas certas ou erradas.</strong>{' '}
                O importante é a sua percepção real do cotidiano.
              </p>

              <div className="rounded-xl border border-gray-100 bg-[#f7f8f6] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="h-4 w-4" style={{ color: '#1AA278' }} />
                  <span className="text-sm font-semibold text-[#0d2a3d]">Sua privacidade está 100% protegida</span>
                </div>
                <ul className="space-y-1.5">
                  {[
                    'Nenhuma informação pessoal é solicitada ou armazenada',
                    'Tecnologia Blind-Drop™ — respostas sem vínculo de identidade',
                    'Dados desta demo são processados apenas localmente',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#1AA278' }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <NextButton onClick={() => setStep('demographics')} />
              </div>
            </div>
          )}

          {/* ── DEMOGRAPHICS ───────────────────────────────────────────── */}
          {step === 'demographics' && (
            <div className="fade-up space-y-8">
              <div>
                <h2 className="text-xl font-bold text-[#0d2a3d] mb-1">Antes de começar</h2>
                <p className="text-sm text-muted-foreground">
                  Dois dados demográficos para enriquecer a análise coletiva — não identificam você.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0d2a3d]">Gênero</label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0d2a3d]">Faixa etária</label>
                  <Select value={ageRange} onValueChange={setAgeRange}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {AGE_RANGES.map((a) => <SelectItem key={a} value={a}>{a} anos</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep('welcome')}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#0d2a3d] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <NextButton onClick={() => { if (gender && ageRange) { setStep('questions'); window.scrollTo({ top: 0 }); } }} disabled={!gender || !ageRange} />
              </div>
            </div>
          )}

          {/* ── QUESTIONS ──────────────────────────────────────────────── */}
          {(step === 'questions' || step === 'submitting') && (
            <div className="fade-up space-y-8">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{answered} de {QUESTIONS.length} respondidas</span>
                <span>{page + 1} / {TOTAL_PAGES}</span>
              </div>

              <div className="space-y-0 divide-y divide-gray-100">
                {currentQs.map((q) => {
                  const invalid = invalidIds.has(q.id);
                  return (
                    <div key={q.id} className={`py-7 ${invalid ? 'pl-3 border-l-2 border-l-red-400 -ml-3' : ''}`}>
                      <p className="text-[#0d2a3d] text-sm font-medium leading-relaxed mb-4">
                        <span className="text-muted-foreground/50 text-xs mr-2">#{q.id}</span>
                        {q.text}
                        {invalid && <span className="ml-2 text-xs text-red-500 font-normal">obrigatório</span>}
                      </p>
                      <RadioGroup
                        value={responses[`q${q.id}`]?.toString() ?? ''}
                        onValueChange={(v) => {
                          setResponses((prev) => ({ ...prev, [`q${q.id}`]: parseInt(v) }));
                          setInvalidIds((prev) => { const n = new Set(prev); n.delete(q.id); return n; });
                        }}
                        className="grid grid-cols-2 sm:grid-cols-5 gap-2"
                      >
                        {LIKERT_SCALE.map((opt) => (
                          <div key={opt.value} className="flex items-center">
                            <RadioGroupItem value={opt.value.toString()} id={`q${q.id}-${opt.value}`} className="peer sr-only" />
                            <Label
                              htmlFor={`q${q.id}-${opt.value}`}
                              className={[
                                'w-full cursor-pointer rounded-lg border-2 px-2 py-2.5 text-xs text-center transition-all select-none',
                                'peer-data-[state=checked]:border-[#144660] peer-data-[state=checked]:bg-[#144660] peer-data-[state=checked]:text-white',
                                'hover:border-[#144660]/40 hover:bg-[#144660]/5',
                                invalid ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white',
                              ].join(' ')}
                            >
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                {page > 0 ? (
                  <button
                    onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0 }); }}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[#0d2a3d] transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : <span />}
                <NextButton onClick={advance} disabled={step === 'submitting'} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NextButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-12 h-12 rounded-full flex items-center justify-center transition-all',
        disabled
          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
          : 'bg-[#144660] text-white hover:bg-[#1a5a80] hover:scale-105 active:scale-95 shadow-md shadow-[#144660]/25',
      ].join(' ')}
    >
      <ArrowRight className="h-5 w-5" />
    </button>
  );
}
