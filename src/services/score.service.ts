import { HSE_DIMENSIONS, RISK_THRESHOLDS_NEGATIVE, NR_MATRIX } from '@/lib/constants';
import { DimensionType, RiskLevel } from '@/types';

export class ScoreService {
  private static normalizeLikertValue(value: number): number {
    if (!Number.isFinite(value)) return value;
    // Compatibilidade com bases legadas 1–5: desloca para 0–4.
    if (value > 4) return value - 1;
    return value;
  }

  private static normalizeScoreByPolarity(score: number, dimensionType: 'positive' | 'negative'): number {
    // Normaliza interpretação para "quanto maior, pior".
    return dimensionType === 'positive' ? 4 - score : score;
  }

  static getQuestionAnswer(responses: Record<string, number>, questionNumber: number): number | undefined {
    const prefixed = responses[`q${questionNumber}`];
    if (typeof prefixed === 'number') return this.normalizeLikertValue(prefixed);

    const raw = responses[String(questionNumber)];
    if (typeof raw === 'number') return this.normalizeLikertValue(raw);

    return undefined;
  }

  // Calculate score for a single dimension from a response's answers
  static calculateDimensionScore(responses: Record<string, number>, dimension: DimensionType): number {
    const dim = HSE_DIMENSIONS.find(d => d.key === dimension);
    if (!dim) return 0;
    const values = dim.questionNumbers
      .map((questionNumber) => this.getQuestionAnswer(responses, questionNumber))
      .filter((value): value is number => typeof value === 'number');
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Number((sum / values.length).toFixed(2));
  }

  // Calculate all 7 dimension scores for a single response
  static calculateAllDimensionScores(responses: Record<string, number>): Record<DimensionType, number> {
    const scores = {} as Record<DimensionType, number>;
    for (const dim of HSE_DIMENSIONS) {
      scores[dim.key as DimensionType] = this.calculateDimensionScore(responses, dim.key as DimensionType);
    }
    return scores;
  }

  // Get risk level for a score given dimension type
  static getRiskLevel(score: number, dimensionType: 'positive' | 'negative'): RiskLevel {
    const normalized = this.normalizeScoreByPolarity(score, dimensionType);
    // Após normalização por polaridade, usamos uma única régua:
    // score alto = pior risco.
    for (const t of RISK_THRESHOLDS_NEGATIVE) {
      if (normalized >= t.min) return t.level as RiskLevel;
    }
    return 'aceitavel';
  }

  // Calculate NR value: probability × severity (both variable 1–4, NR range 1–16)
  static calculateNR(riskLevel: RiskLevel): number {
    return NR_MATRIX[riskLevel].probability * NR_MATRIX[riskLevel].severity;
    // aceitavel: 1×1=1, moderado: 2×2=4, importante: 3×3=9, critico: 4×4=16
  }

  // Interpret NR value (scale 1–16)
  static interpretNR(nr: number): { label: string; color: string } {
    if (nr <= 4)  return { label: 'Aceitável',  color: '#A2C06A' };
    if (nr <= 8)  return { label: 'Moderado',   color: '#FFFF00' };
    if (nr <= 12) return { label: 'Importante', color: '#F79454' };
    return           { label: 'Crítico',    color: '#FF0000' };
  }

  // Calculate IGRP = mean of all 7 dimension NR values (range 1–16)
  static calculateIGRP(dimensionScores: Record<DimensionType, number>): number {
    let totalNR = 0;
    let count = 0;
    for (const dim of HSE_DIMENSIONS) {
      const score = dimensionScores[dim.key as DimensionType] ?? 0;
      const risk = this.getRiskLevel(score, dim.type);
      const nr = this.calculateNR(risk);
      totalNR += nr;
      count++;
    }
    return Number((totalNR / count).toFixed(2));
  }

  // Returns true if NR >= 9 (Importante or Crítico) — "high risk" territory
  static isHighRisk(nr: number): boolean {
    return nr >= 9;
  }
}
