// HSE Agent — LLM client for psychosocial risk action plan generation.
// When AI_SERVICE_URL is set, delegates to the Python FastAPI service (port 8001).
// Otherwise falls back to direct provider calls (openrouter/openai/anthropic).

export type ActionType = 'corretiva' | 'preventiva' | 'contingencia' | 'paliativa';
export type ActionStatus = 'pendente' | 'em_andamento' | 'concluida';
export type RiskLevelKey = 'critico' | 'importante' | 'moderado' | 'aceitavel';

export interface PlannedAction {
  id: string;
  type: ActionType;
  action: string;
  responsible: string;
  deadline: string;
  resources: string;
  indicator: string;
  status: ActionStatus;
}

export interface ActionPlanProblem {
  id: string;
  dimension_key: string;
  dimension_name: string;
  risk_level: RiskLevelKey;
  score: number;
  nr: number;
  problem_title: string;
  problem_description: string;
  root_causes: string[];
  impact: string;
  legal_reference: string;
  monitoring: string;
  actions: PlannedAction[];
}

export interface GeneratedActionPlan {
  problems: ActionPlanProblem[];
  model_used: string;
}

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

export interface AgentDimensionInput {
  key: string;
  name: string;
  type: 'positive' | 'negative';
  avg_score: number;
  risk_level: string;
  nr: number;
  nr_label: string;
}

export interface AgentInput {
  campaign_name: string;
  company_name: string;
  total_responded: number;
  igrp: number;
  igrp_label: string;
  dimensions: AgentDimensionInput[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Você é um especialista em Saúde Ocupacional e Psicossocial com certificação em HSE-IT (Health and Safety Executive – Indicator Tool) e profundo conhecimento da NR-1 brasileira (Gerenciamento de Riscos Ocupacionais – GRO/PGR).

Sua tarefa é analisar os resultados de uma avaliação de riscos psicossociais e gerar um Plano de Ação estruturado em JSON.

## Sobre o instrumento HSE-IT
O HSE-IT avalia 7 dimensões de riscos psicossociais no trabalho:
- **Demandas** (negativa): excesso de trabalho, pressão, horas extras. Score alto = alto risco.
- **Controle** (positiva): autonomia, participação nas decisões. Score baixo = alto risco.
- **Apoio da Chefia** (positiva): suporte e feedback da liderança. Score baixo = alto risco.
- **Apoio dos Colegas** (positiva): suporte peer-to-peer. Score baixo = alto risco.
- **Relacionamentos** (negativa): conflitos, assédio, comportamentos negativos. Score alto = alto risco.
- **Cargo/Função** (positiva): clareza de papel, reconhecimento. Score baixo = alto risco.
- **Comunicação e Mudanças** (positiva): informação sobre mudanças organizacionais. Score baixo = alto risco.

## Níveis de risco e IGRP
- **Crítico**: NR = 16 → ação imediata obrigatória
- **Importante**: NR = 9 → ação planejada urgente
- **Moderado**: NR = 4 → ação preventiva e contingência
- **Aceitável**: NR = 1 → monitoramento e ações paliativas

IGRP (Índice Geral de Risco Psicossocial) = média dos NR das 7 dimensões (escala 1–16).

## Regra de saída
Retorne APENAS JSON válido, sem texto antes ou depois, sem markdown.
O JSON deve ter exatamente este formato:

{
  "problems": [
    {
      "id": "prob_{dimension_key}",
      "dimension_key": "{key}",
      "dimension_name": "{nome}",
      "risk_level": "critico|importante|moderado|aceitavel",
      "score": 0.00,
      "nr": 0,
      "problem_title": "Título conciso do problema (máx 60 chars)",
      "problem_description": "Descrição do problema em 2-3 frases, contextualizando o risco.",
      "root_causes": ["causa 1", "causa 2", "causa 3"],
      "impact": "Impacto esperado se não tratado (1 frase)",
      "legal_reference": "NR-1, item X.Y — descrição",
      "monitoring": "Como monitorar a eficácia das ações (1 frase)",
      "actions": [
        {
          "id": "act_{dimension_key}_{nn}",
          "type": "corretiva|preventiva|contingencia|paliativa",
          "action": "Descrição clara e específica da ação",
          "responsible": "",
          "deadline": "",
          "resources": "",
          "indicator": "KPI para medir o sucesso (1 frase)",
          "status": "pendente"
        }
      ]
    }
  ]
}

## Regras para as ações
- Dimensões **críticas/importantes**: mínimo 3 ações, maioria do tipo "corretiva"
- Dimensões **moderadas**: 2 ações, tipos "preventiva" e "contingencia"
- Dimensões **aceitáveis**: 1-2 ações do tipo "paliativa" (manutenção)
- "responsible", "deadline" e "resources" ficam VAZIOS (serão preenchidos pela empresa)
- Ações devem ser específicas, mensuráveis e relacionadas à dimensão
- legal_reference deve citar NR-1 item 1.5, item 1.6 ou NR específica conforme o risco
- Inclua TODAS as 7 dimensões, ordenadas do maior NR para o menor`;

function buildUserPrompt(input: AgentInput): string {
  const dimLines = input.dimensions
    .map(d =>
      `- ${d.name}: score=${d.avg_score.toFixed(2)}, risco=${d.risk_level.toUpperCase()}, NR=${d.nr} (${d.nr_label}), tipo=${d.type}`
    )
    .join('\n');

  return `Empresa: ${input.company_name}
Campanha: ${input.campaign_name}
Total de respondentes: ${input.total_responded}
IGRP Geral: ${input.igrp} — ${input.igrp_label}

Resultados por dimensão:
${dimLines}

Gere o Plano de Ação completo para TODAS as 7 dimensões, ordenado do maior para o menor risco (NR decrescente).`;
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

async function callOpenAICompat(messages: ChatMessage[], provider: 'openrouter' | 'openai'): Promise<string> {
  const isOR = provider === 'openrouter';
  const apiKey = isOR
    ? process.env.OPENROUTER_API_KEY
    : process.env.OPENAI_API_KEY;
  const model = isOR
    ? (process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct')
    : (process.env.OPENAI_MODEL ?? 'gpt-4o-mini');
  const baseUrl = isOR
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.openai.com/v1';

  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY not set`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (isOR) {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL ?? 'https://asta.app';
    headers['X-Title'] = 'Asta — HSE Agent';
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider} API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[]; model: string };
  return data.choices[0]?.message?.content ?? '';
}

async function callAnthropic(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const system = messages.find(m => m.role === 'system')?.content ?? '';
  const userMessages = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: userMessages,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === 'text')?.text ?? '';
}

// ---------------------------------------------------------------------------
// Python service integration
// ---------------------------------------------------------------------------

interface PythonW5H2Action {
  id: string;
  what: string;
  why: string;
  who: string;
  where: string;
  when: string;
  how: string;
  how_much: string;
  status: string;
}

interface PythonProblem {
  titulo: string;
  descricao: string;
  nivel_risco: string;
  dimensao_afetada: string;
  causas_raiz: string[];
  impacto: string;
  referencia_legal: string;
  monitoramento: string;
}

interface PythonAnalysisResponse {
  analysis: string;
  problems: PythonProblem[];
  action_plan: PythonW5H2Action[];
  pdca: { plan: string[]; do: string[]; check: string[]; act: string[] };
  rag_used: boolean;
  model: string;
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const NIVEL_TO_RISK: Record<string, RiskLevelKey> = {
  critico: 'critico', importante: 'importante', moderado: 'moderado', aceitavel: 'aceitavel',
};

const DIM_KEYWORDS: Array<{ key: string; keywords: string[] }> = [
  { key: 'demandas',             keywords: ['demanda'] },
  { key: 'controle',             keywords: ['controle'] },
  { key: 'apoio_chefia',         keywords: ['chefia', 'lideranca', 'superior', 'gestor'] },
  { key: 'apoio_colegas',        keywords: ['colega', 'par ', 'equipe', 'colegas'] },
  { key: 'relacionamentos',      keywords: ['relacionamento', 'conflito', 'assedio'] },
  { key: 'cargo',                keywords: ['cargo', 'funcao', 'papel', 'reconhecimento'] },
  { key: 'comunicacao_mudancas', keywords: ['comunicacao', 'mudanca'] },
];

function resolveDimension(dimensao: string): string {
  const norm = normalizeStr(dimensao);
  for (const { key, keywords } of DIM_KEYWORDS) {
    if (keywords.some(kw => norm.includes(kw))) return key;
  }
  return 'demandas';
}

function mapW5H2ToPlannedAction(
  a: PythonW5H2Action,
  dimKey: string,
  riskLevel: RiskLevelKey,
  idx: number,
): PlannedAction {
  const typeByRisk: Record<RiskLevelKey, ActionType> = {
    critico: 'corretiva', importante: 'corretiva',
    moderado: 'preventiva', aceitavel: 'paliativa',
  };
  const resources = [a.how, a.how_much].filter(Boolean).join(' — ');
  const rawStatus = a.status ?? '';
  const status: ActionStatus =
    rawStatus === 'em_andamento' ? 'em_andamento' :
    rawStatus === 'concluida'    ? 'concluida' : 'pendente';

  return {
    id: a.id || `act_${dimKey}_${String(idx + 1).padStart(2, '0')}`,
    type: typeByRisk[riskLevel] ?? 'preventiva',
    action: a.what,
    responsible: a.who,
    deadline: a.when,
    resources,
    indicator: a.why,
    status,
  };
}

function mapPythonToGeneratedPlan(response: PythonAnalysisResponse, input: AgentInput): GeneratedActionPlan {
  const problemCount = response.problems.length;

  const problems: ActionPlanProblem[] = response.problems.map((p, i) => {
    const risk_level: RiskLevelKey = NIVEL_TO_RISK[normalizeStr(p.nivel_risco)] ?? 'moderado';
    const dimension_key = resolveDimension(p.dimensao_afetada);
    const dimInput = input.dimensions.find(d => d.key === dimension_key);
    const dimension_name = dimInput?.name ?? p.dimensao_afetada;
    const score = dimInput?.avg_score ?? 0;
    const nr = dimInput?.nr ?? 0;

    // Distribute actions round-robin across problems
    const myActions = response.action_plan.filter((_, ai) => ai % Math.max(problemCount, 1) === i);

    return {
      id: `prob_${dimension_key}_${i + 1}`,
      dimension_key,
      dimension_name,
      risk_level,
      score,
      nr,
      problem_title: p.titulo,
      problem_description: p.descricao,
      root_causes: p.causas_raiz ?? [],
      impact: p.impacto ?? '',
      legal_reference: p.referencia_legal ?? '',
      monitoring: p.monitoramento ?? '',
      actions: myActions.map((a, ai) => mapW5H2ToPlannedAction(a, dimension_key, risk_level, ai)),
    };
  });

  // Fallback: no problems returned but actions exist
  if (problems.length === 0 && response.action_plan.length > 0) {
    const igrpRisk: RiskLevelKey =
      input.igrp >= 13 ? 'critico' :
      input.igrp >= 9  ? 'importante' :
      input.igrp >= 5  ? 'moderado' : 'aceitavel';

    problems.push({
      id: 'prob_geral_1',
      dimension_key: 'demandas',
      dimension_name: 'Análise Geral',
      risk_level: igrpRisk,
      score: input.igrp,
      nr: input.igrp,
      problem_title: 'Plano de Ação Psicossocial',
      problem_description: response.analysis,
      root_causes: [],
      impact: '',
      legal_reference: 'NR-1, item 1.5 — Identificação de perigos e avaliação de riscos ocupacionais',
      monitoring: '',
      actions: response.action_plan.map((a, ai) => mapW5H2ToPlannedAction(a, 'demandas', igrpRisk, ai)),
    });
  }

  return { problems, model_used: response.model };
}

async function callPythonService(input: AgentInput): Promise<GeneratedActionPlan> {
  const serviceUrl = process.env.AI_SERVICE_URL!;
  const secretKey = process.env.AI_SECRET_KEY ?? '';

  const res = await fetch(`${serviceUrl}/insights/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      chart_key: 'campaign_full_analysis',
      chart_label: 'Análise Psicossocial Completa — HSE-IT',
      chart_data: {
        company_name: input.company_name,
        total_responded: input.total_responded,
        igrp: input.igrp,
        igrp_label: input.igrp_label,
        dimensions: input.dimensions,
      },
      campaign_name: input.campaign_name,
      use_rag: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Python AI service error ${res.status}: ${err}`);
  }

  const data = await res.json() as PythonAnalysisResponse;
  return mapPythonToGeneratedPlan(data, input);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generateActionPlan(input: AgentInput): Promise<GeneratedActionPlan> {
  // Delegate to Python service when AI_SERVICE_URL is configured
  if (process.env.AI_SERVICE_URL) {
    return callPythonService(input);
  }

  // Direct provider fallback (openrouter / openai / anthropic)
  const provider = (process.env.LLM_PROVIDER ?? 'openrouter') as 'openrouter' | 'openai' | 'anthropic';
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(input) },
  ];

  let raw: string;
  if (provider === 'anthropic') {
    raw = await callAnthropic(messages);
  } else {
    raw = await callOpenAICompat(messages, provider);
  }

  // Strip potential markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: { problems: ActionPlanProblem[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.problems)) {
    throw new Error('LLM response missing problems array');
  }

  const modelUsed =
    provider === 'openrouter' ? (process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct') :
    provider === 'openai'     ? (process.env.OPENAI_MODEL ?? 'gpt-4o-mini') :
                                (process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001');

  return { problems: parsed.problems, model_used: modelUsed };
}
