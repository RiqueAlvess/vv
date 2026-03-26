/**
 * HSE-IT Psychosocial Risk Scoring
 *
 * Pure functions — no side effects, no Prisma, no React.
 * Safe to use in Server Actions, API routes, workers, or unit tests.
 *
 * Implements the HSE Management Standards Indicator Tool scoring logic
 * adapted for Brazilian NR-1 psychosocial risk classification.
 *
 * ── Scale ──────────────────────────────────────────────────────────────────
 * Each question uses a 5-point Likert scale (0–4):
 *   0 = Discordo Totalmente  /  Nunca
 *   1 = Discordo             /  Raramente
 *   2 = Neutro               /  Às vezes
 *   3 = Concordo             /  Frequentemente
 *   4 = Concordo Totalmente  /  Sempre
 *
 * ── Inverse logic (polarity) ───────────────────────────────────────────────
 * NEGATIVE dimensions (Demands, Relationships):
 *   "My workload is unmanageable" — agreement (high score) is the bad outcome.
 *   high rawScore → high risk
 *
 * POSITIVE dimensions (Control, Manager Support, Peer Support, Role, Change):
 *   "I can decide how to do my work" — disagreement (low score) is the bad outcome.
 *   low rawScore → high risk
 *
 * ── Derivation chain ───────────────────────────────────────────────────────
 *   rawScore (0–4)  →  riskLevel  →  probability (1–4)  →  nrValue = prob × severity
 *
 *   The riskLevel is the authoritative classification.
 *   nrValue is the NR-1 numeric output used in compliance reports.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = 'aceitavel' | 'moderado' | 'importante' | 'critico';

export interface DimensionScore {
  /** Internal key used in DB and analytics queries */
  key: string;
  /** Human-readable label (Portuguese) */
  name: string;
  /**
   * Whether the dimension is measured inversely.
   * negative = high score is bad; positive = low score is bad.
   */
  polarity: 'negative' | 'positive';
  /** Average of all question responses in this dimension (0–4, rounded to 2dp) */
  rawScore: number;
  /** NR-1 risk classification — the authoritative output */
  riskLevel: RiskLevel;
  /** NR-1 Probability factor derived from riskLevel (1 = low, 4 = high) */
  probability: number;
  /** NR-1 Severity factor (fixed at 2 — moderate exposure baseline for psychosocial) */
  severity: number;
  /** NR value = probability × severity (used in compliance risk matrices) */
  nrValue: number;
  /** Short human-readable classification (Portuguese) */
  interpretation: string;
  /** Hex color for UI display */
  color: string;
}

export interface HSEITScoreResult {
  /** One entry per dimension, in survey order */
  dimensions: DimensionScore[];
  /**
   * IGRP — Índice Geral de Risco Psicossocial
   * Arithmetic mean of all 7 dimension nrValues.
   * Represents the overall psychosocial exposure level for a single respondent
   * (or for an aggregate if called via aggregateHSEITScores).
   */
  igrp: number;
  igrpInterpretation: string;
  igrpColor: string;
}

// ─── Dimension catalogue ───────────────────────────────────────────────────

interface DimensionSpec {
  key: string;
  name: string;
  polarity: 'negative' | 'positive';
  /** 1-based question numbers belonging to this dimension */
  questionNumbers: number[];
}

const DIMENSIONS: readonly DimensionSpec[] = [
  {
    key: 'demandas',
    name: 'Demandas',
    polarity: 'negative',            // high score = overloaded = high risk
    questionNumbers: [3, 6, 9, 12, 16, 18, 20, 22],
  },
  {
    key: 'controle',
    name: 'Controle',
    polarity: 'positive',            // low score = no autonomy = high risk
    questionNumbers: [2, 10, 15, 19, 25, 30],
  },
  {
    key: 'apoio_chefia',
    name: 'Apoio da Chefia',
    polarity: 'positive',            // low score = no managerial support = high risk
    questionNumbers: [8, 23, 29, 33, 35],
  },
  {
    key: 'apoio_colegas',
    name: 'Apoio dos Colegas',
    polarity: 'positive',            // low score = social isolation = high risk
    questionNumbers: [7, 24, 27, 31],
  },
  {
    key: 'relacionamentos',
    name: 'Relacionamentos',
    polarity: 'negative',            // high score = conflict / bullying present = high risk
    questionNumbers: [5, 14, 21, 34],
  },
  {
    key: 'cargo',
    name: 'Cargo/Função',
    polarity: 'positive',            // low score = role ambiguity = high risk
    questionNumbers: [1, 4, 11, 13, 17],
  },
  {
    key: 'comunicacao_mudancas',
    name: 'Comunicação e Mudanças',
    polarity: 'positive',            // low score = change blindness = high risk
    questionNumbers: [26, 28, 32],
  },
] as const;

// ─── Step 1: rawScore → riskLevel (polarity-aware) ─────────────────────────

/**
 * Maps a 0–4 dimension average to a risk level.
 *
 * Thresholds for NEGATIVE dimensions (high score is dangerous):
 *   score ≥ 3.1  →  crítico
 *   score ≥ 2.1  →  importante
 *   score ≥ 1.1  →  moderado
 *   score < 1.1  →  aceitável
 *
 * Thresholds for POSITIVE dimensions (low score is dangerous — mirrored):
 *   score ≤ 1.0  →  crítico
 *   score ≤ 2.0  →  importante
 *   score ≤ 3.0  →  moderado
 *   score > 3.0  →  aceitável
 */
function scoreToRiskLevel(score: number, polarity: 'negative' | 'positive'): RiskLevel {
  if (polarity === 'negative') {
    if (score >= 3.1) return 'critico';
    if (score >= 2.1) return 'importante';
    if (score >= 1.1) return 'moderado';
    return 'aceitavel';
  } else {
    // Positive: low score = high risk → thresholds are inverted
    if (score <= 1.0) return 'critico';
    if (score <= 2.0) return 'importante';
    if (score <= 3.0) return 'moderado';
    return 'aceitavel';
  }
}

// ─── Step 2: riskLevel → NR-1 components ──────────────────────────────────

/**
 * NR-1 probability factors. These represent the estimated likelihood that
 * the risk condition will cause a measurable psychosocial harm event.
 */
const PROBABILITY: Record<RiskLevel, number> = {
  aceitavel:  1,
  moderado:   2,
  importante: 3,
  critico:    4,
};

/**
 * Fixed severity = 2 (moderate).
 * Psychosocial risk severity is assumed moderate at baseline under NR-1,
 * pending a specific workplace severity assessment by an occupational psychologist.
 */
const SEVERITY = 2;

/** nrValue = probability × severity */
function riskToNR(riskLevel: RiskLevel): number {
  return PROBABILITY[riskLevel] * SEVERITY;
}

// ─── Presentation layer ────────────────────────────────────────────────────

const RISK_DISPLAY: Record<RiskLevel, { interpretation: string; color: string }> = {
  aceitavel:  { interpretation: 'Aceitável',  color: '#22c55e' },
  moderado:   { interpretation: 'Moderado',   color: '#eab308' },
  importante: { interpretation: 'Importante', color: '#f97316' },
  critico:    { interpretation: 'Crítico',    color: '#ef4444' },
};

// ─── IGRP interpretation ───────────────────────────────────────────────────

/** Maps an IGRP (mean nrValue across dimensions) to a risk tier. */
function igrpToRiskLevel(igrp: number): RiskLevel {
  // IGRP range with severity=2: min=2 (all aceitável) to max=8 (all crítico)
  if (igrp >= 7) return 'critico';
  if (igrp >= 5) return 'importante';
  if (igrp >= 3) return 'moderado';
  return 'aceitavel';
}

// ─── Core computation ──────────────────────────────────────────────────────

/**
 * Computes the full HSE-IT psychosocial risk profile from 35 question answers.
 *
 * @param answers - Map of question keys to Likert values.
 *   Keys must be `q{N}` (e.g. `q1`, `q35`). Case-insensitive. Missing keys = 0.
 *   Values are clamped to [0, 4] — out-of-range inputs won't throw.
 *
 * @returns `HSEITScoreResult` with per-dimension breakdown and overall IGRP.
 *
 * @example
 * const result = calculateHSEITScores({
 *   q1: 4, q2: 1, q3: 4, q4: 3, q5: 4,
 *   // ...remaining 30 questions
 * });
 *
 * result.dimensions[0].key          // 'demandas'
 * result.dimensions[0].rawScore     // e.g. 3.5
 * result.dimensions[0].riskLevel    // 'critico'
 * result.dimensions[0].nrValue      // 8  (= prob 4 × severity 2)
 * result.igrp                       // e.g. 5.71
 * result.igrpInterpretation         // 'Importante'
 */
export function calculateHSEITScores(answers: Record<string, number>): HSEITScoreResult {
  const dimensions: DimensionScore[] = DIMENSIONS.map((spec) => {
    // ── Average the raw Likert values for this dimension ──────────────────
    const values = spec.questionNumbers.map((n) => {
      // Accept both lower and upper case key prefixes
      const val = answers[`q${n}`] ?? answers[`Q${n}`] ?? 0;
      return Math.max(0, Math.min(4, val)); // clamp to valid scale
    });
    const rawScore = round2(values.reduce((sum, v) => sum + v, 0) / values.length);

    // ── Step 1: classify using polarity-aware thresholds ─────────────────
    const riskLevel = scoreToRiskLevel(rawScore, spec.polarity);

    // ── Step 2: derive NR-1 components ───────────────────────────────────
    const probability = PROBABILITY[riskLevel];
    const nrValue = riskToNR(riskLevel);

    const { interpretation, color } = RISK_DISPLAY[riskLevel];

    return {
      key: spec.key,
      name: spec.name,
      polarity: spec.polarity,
      rawScore,
      riskLevel,
      probability,
      severity: SEVERITY,
      nrValue,
      interpretation,
      color,
    };
  });

  // ── IGRP = mean of all dimension nrValues ─────────────────────────────
  const igrp = round2(
    dimensions.reduce((sum, d) => sum + d.nrValue, 0) / dimensions.length
  );
  const igrpLevel = igrpToRiskLevel(igrp);
  const { interpretation: igrpInterpretation, color: igrpColor } = RISK_DISPLAY[igrpLevel];

  return { dimensions, igrp, igrpInterpretation, igrpColor };
}

// ─── Batch aggregation (analytics layer) ──────────────────────────────────

/**
 * Aggregates HSE-IT scores across multiple responses.
 *
 * Instead of scoring each response individually and averaging the risk levels
 * (which would lose granularity), this function averages the raw Likert values
 * per question first, then runs one scoring pass on the averages.
 * This produces the same result as scoring the centroid of the response cloud.
 *
 * @param allAnswers - Array of answer maps, one per survey submission.
 * @returns `HSEITScoreResult` representing the aggregate risk profile,
 *   or `null` if the array is empty.
 *
 * @example
 * const campaignResult = aggregateHSEITScores(responses.map(r => r.answers));
 */
export function aggregateHSEITScores(
  allAnswers: Record<string, number>[]
): HSEITScoreResult | null {
  if (!allAnswers.length) return null;

  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const answers of allAnswers) {
    for (const spec of DIMENSIONS) {
      for (const n of spec.questionNumbers) {
        const key = `q${n}`;
        const val = Math.max(0, Math.min(4, answers[key] ?? 0));
        totals[key] = (totals[key] ?? 0) + val;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }

  const avgAnswers: Record<string, number> = {};
  for (const key of Object.keys(totals)) {
    avgAnswers[key] = round2(totals[key] / counts[key]);
  }

  return calculateHSEITScores(avgAnswers);
}

// ─── Utility ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
