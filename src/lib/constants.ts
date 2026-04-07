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

export const NR_MATRIX: Record<RiskLevel, { probability: number; severity: number }> & { default_severity: number } = {
  critico:    { probability: 4, severity: 4 },  // ALTO RISCO → P=4, S=4 → NR=16
  importante: { probability: 3, severity: 3 },  // Risco Moderado → P=3, S=3 → NR=9
  moderado:   { probability: 2, severity: 2 },  // Risco Médio → P=2, S=2 → NR=4
  aceitavel:  { probability: 1, severity: 1 },  // Baixo Risco → P=1, S=1 → NR=1
  default_severity: 3, // conservative default (Significativo) for dashboard use
};

export const NR_INTERPRETATION: { maxNR: number; label: string; color: string }[] = [
  { maxNR: 4,  label: 'Baixo Risco',     color: '#8ba800' },  // olive green
  { maxNR: 8,  label: 'Risco Médio',     color: '#d4b000' },  // yellow
  { maxNR: 12, label: 'Risco Moderado',  color: '#cc7722' },  // brownish orange
  { maxNR: 16, label: 'Alto Risco',      color: '#cc0000' },  // bright red
];

// ============================================================
// Colors and UI Constants
// ============================================================

export const RISK_COLORS: Record<RiskLevel, string> = {
  aceitavel: '#8ba800',   // olive green  — Baixo Risco
  moderado:  '#d4b000',   // yellow       — Risco Médio
  importante:'#cc7722',   // brownish orange — Risco Moderado
  critico:   '#cc0000',   // bright red   — Alto Risco
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
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
  { value: 'N', label: 'Prefiro não informar' },
];
