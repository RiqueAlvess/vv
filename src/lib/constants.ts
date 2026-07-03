import type { DimensionType, RiskLevel } from '@/types';

// ============================================================
// HSE Dimensions Configuration
// ============================================================

export interface DimensionConfig {
  key: DimensionType;
  name: string;
  type: 'positive' | 'negative';
  questionNumbers: number[];
}

export const HSE_DIMENSIONS: DimensionConfig[] = [
  {
    key: 'demandas',
    name: 'Demandas',
    type: 'negative',
    questionNumbers: [3, 6, 9, 12, 16, 18, 20, 22],
  },
  {
    key: 'controle',
    name: 'Controle',
    type: 'positive',
    questionNumbers: [2, 10, 15, 19, 25, 30],
  },
  {
    key: 'apoio_chefia',
    name: 'Apoio da Chefia',
    type: 'positive',
    questionNumbers: [8, 23, 29, 33, 35],
  },
  {
    key: 'apoio_colegas',
    name: 'Apoio dos Colegas',
    type: 'positive',
    questionNumbers: [7, 24, 27, 31],
  },
  {
    key: 'relacionamentos',
    name: 'Relacionamentos',
    type: 'negative',
    questionNumbers: [5, 14, 21, 34],
  },
  {
    key: 'cargo',
    name: 'Cargo/Função',
    type: 'positive',
    questionNumbers: [1, 4, 11, 13, 17],
  },
  {
    key: 'comunicacao_mudancas',
    name: 'Comunicação e Mudanças',
    type: 'positive',
    questionNumbers: [26, 28, 32],
  },
];

// ============================================================
// Risk Thresholds
// ============================================================

export const RISK_THRESHOLDS_NEGATIVE: { min: number; level: RiskLevel }[] = [
  { min: 3.1, level: 'critico' },
  { min: 2.1, level: 'importante' },
  { min: 1.1, level: 'moderado' },
  { min: 0, level: 'aceitavel' },
];

export const RISK_THRESHOLDS_POSITIVE: { max: number; level: RiskLevel }[] = [
  { max: 1.0, level: 'critico' },
  { max: 2.0, level: 'importante' },
  { max: 3.0, level: 'moderado' },
  { max: 4, level: 'aceitavel' },
];

// ============================================================
// NR Matrix (Risk Assessment)
// ============================================================

// Probability reflects exposure likelihood derived from the risk level (same for all dimensions).
export const NR_PROBABILITY: Record<RiskLevel, number> = {
  aceitavel:  1,
  moderado:   2,
  importante: 3,
  critico:    4,
};

// Severity is intrinsic to each dimension — how serious the health impact is
// IF that psychosocial risk materialises, regardless of frequency.
//   1 = Leve (desconforto, impacto mínimo)
//   2 = Moderado (sofrimento psicológico moderado)
//   3 = Significativo (início de adoecimento)
//   4 = Grave (burnout, depressão, CAT)
export const DIMENSION_SEVERITY: Record<string, number> = {
  demandas:              4, // sobrecarga → burnout, IAM, afastamento
  relacionamentos:       4, // assédio/violência → trauma, adoecimento grave
  apoio_chefia:          3, // falta de suporte → sofrimento progressivo
  controle:              3, // ausência de autonomia → adoecimento crônico
  apoio_colegas:         2, // isolamento social → impacto moderado
  cargo:                 2, // ambiguidade de função → impacto moderado
  comunicacao_mudancas:  2, // gestão de mudança → impacto leve-moderado
};

// Keep for backwards compat with any consumer that references NR_MATRIX directly.
// Probability === severity here only as a neutral default; prefer DIMENSION_SEVERITY above.
export const NR_MATRIX: Record<RiskLevel, { probability: number; severity: number }> & { default_severity: number } = {
  critico:    { probability: 4, severity: 4 },
  importante: { probability: 3, severity: 3 },
  moderado:   { probability: 2, severity: 2 },
  aceitavel:  { probability: 1, severity: 1 },
  default_severity: 3,
};

export const NR_INTERPRETATION: { maxNR: number; label: string; color: string }[] = [
  { maxNR: 4,  label: 'Risco Baixo',     color: '#009B00' },  // green
  { maxNR: 8,  label: 'Risco Médio',     color: '#F7B511' },  // yellow
  { maxNR: 12, label: 'Risco Moderado',  color: '#F75900' },  // orange
  { maxNR: 16, label: 'Risco Alto',      color: '#F60000' },  // red
];

// ============================================================
// Colors and UI Constants
// ============================================================

export const RISK_COLORS: Record<RiskLevel, string> = {
  aceitavel: '#009B00',   // green   — Aceitável
  moderado:  '#F7B511',   // yellow  — Moderado
  importante:'#F75900',   // orange  — Importante
  critico:   '#F60000',   // red     — Crítico
};

// ============================================================
// Survey Constants
// ============================================================

export const LIKERT_SCALE: { value: number; label: string }[] = [
  { value: 0, label: 'Nunca' },
  { value: 1, label: 'Raramente' },
  { value: 2, label: 'Às vezes' },
  { value: 3, label: 'Frequentemente' },
  { value: 4, label: 'Sempre' },
];

export const AGE_RANGES: string[] = [
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65+',
];

export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'MULHER_CIS',   label: 'Mulher Cisgênero' },
  { value: 'MULHER_TRANS', label: 'Mulher Transgênero' },
  { value: 'HOMEM_CIS',    label: 'Homem Cisgênero' },
  { value: 'HOMEM_TRANS',  label: 'Homem Transgênero' },
  { value: 'NAO_BINARIO',  label: 'Não binário' },
  { value: 'OUTRO',        label: 'Outro' },
  { value: 'NAO_INFORMAR', label: 'Prefiro não informar' },
];

export const GENDER_LABELS: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS.map(({ value, label }) => [value, label])
);

// ============================================================
// HSE-IT Question Texts (35 questions)
// ============================================================

// Pulse survey: 1 representative question per dimension (highest factor loading)
export const PULSE_QUESTIONS: { id: number; text: string; dimension: DimensionType }[] = [
  { id: 9,  text: 'Devo trabalhar muito intensamente',                                     dimension: 'demandas' },
  { id: 19, text: 'Tenho uma palavra a dizer sobre o ritmo em que trabalho',                dimension: 'controle' },
  { id: 35, text: 'Meu chefe me incentiva no trabalho',                                     dimension: 'apoio_chefia' },
  { id: 7,  text: 'Quando o trabalho se torna difícil, posso contar com ajuda dos colegas', dimension: 'apoio_colegas' },
  { id: 5,  text: 'Falam ou se comportam comigo de forma dura',                             dimension: 'relacionamentos' },
  { id: 1,  text: 'Tenho clareza sobre o que se espera do meu trabalho',                    dimension: 'cargo' },
  { id: 28, text: 'As pessoas são sempre consultadas sobre as mudanças no trabalho',         dimension: 'comunicacao_mudancas' },
];

export const PULSE_CADENCES: { value: string; label: string }[] = [
  { value: 'mensal',     label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral',  label: 'Semestral' },
];

// ============================================================
// GHE / Sector Privacy (Blind-Drop anonymity)
// ============================================================

// Sectors with fewer respondents than this are never shown with real data —
// dashboard GHE table and PGR PDF/HTML both suppress them to protect anonymity.
export const SECTOR_PRIVACY_MIN = 5;

export const SECTOR_PRIVACY_MESSAGE =
  'Dados protegidos por privacidade — este setor tem menos de 5 respondentes e não pode ser exibido individualmente. Consulte o GHE geral da empresa para uma visão consolidada.';

export const HSE_QUESTIONS: Record<number, string> = {
  1:  'Eu sei exatamente o que é esperado de mim no trabalho',
  2:  'Posso decidir quando fazer uma pausa',
  3:  'Diferentes grupos no trabalho exigem coisas de mim que são difíceis de combinar',
  4:  'Eu sei como fazer meu trabalho',
  5:  'Estou sujeito(a) a atenção pessoal ou assédio na forma de palavras ou comportamentos ofensivos',
  6:  'Tenho prazos inatingíveis',
  7:  'Se o trabalho fica difícil, meus colegas me ajudam',
  8:  'Sou apoiado(a) em uma crise emocional no trabalho',
  9:  'Tenho que trabalhar muito intensamente',
  10: 'Tenho voz nas mudanças no modo como faço meu trabalho',
  11: 'Tenho tempo suficiente para completar meu trabalho',
  12: 'Tenho que desconsiderar regras ou procedimentos para fazer o trabalho',
  13: 'Sei qual é o meu papel e responsabilidades',
  14: 'Tenho que trabalhar com pessoas que têm valores de trabalho diferentes',
  15: 'Posso planejar quando fazer as pausas',
  16: 'Tenho volume de trabalho pesado',
  17: 'Existe uma boa combinação entre o que a organização espera de mim e as habilidades que tenho',
  18: 'Tenho que trabalhar muito rapidamente',
  19: 'Tenho uma palavra a dizer sobre o ritmo em que trabalho',
  20: 'Tenho que negligenciar alguns aspectos do meu trabalho porque tenho muito a fazer',
  21: 'Existe fricção ou raiva entre colegas',
  22: 'Não tenho tempo para fazer uma pausa',
  23: 'Minha chefia imediata me encoraja no trabalho',
  24: 'Recebo o respeito no trabalho que mereço de meus colegas',
  25: 'Tenho controle sobre quando fazer uma pausa',
  26: 'Os funcionários são sempre consultados sobre mudanças no trabalho',
  27: 'Posso contar com meus colegas para me ajudar quando as coisas ficam difíceis no trabalho',
  28: 'Posso conversar com minha chefia sobre algo que me incomodou',
  29: 'Minha chefia me apoia para o trabalho',
  30: 'Tenho alguma participação em decisões sobre o meu trabalho',
  31: 'Recebo ajuda e apoio de meus colegas',
  32: 'Quando ocorrem mudanças no trabalho, tenho clareza sobre como funcionará na prática',
  33: 'Recebo feedback sobre o meu trabalho',
  34: 'Existe tensão entre mim e colegas de trabalho',
  35: 'Minha chefia me incentiva nas minhas atividades',
};
