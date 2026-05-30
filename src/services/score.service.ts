import { HSE_DIMENSIONS, RISK_THRESHOLDS_NEGATIVE, RISK_THRESHOLDS_POSITIVE, NR_PROBABILITY, RISK_COLORS } from '@/lib/constants';
import { DimensionType, RiskLevel } from '@/types';

export class ScoreService {
  private static normalizeLikertValue(value: number): number {
    if (!Number.isFinite(value)) return value;
    // Compatibilidade com bases legadas 1–5: desloca para 0–4.
    if (value > 4) return value - 1;
    return value;
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
    if (dimensionType === 'negative') {
      // NEGATIVE: high score = high risk (Demandas, Relacionamentos)
      for (const t of RISK_THRESHOLDS_NEGATIVE) {
        if (score >= t.min) return t.level as RiskLevel;
      }
      return 'aceitavel';
    } else {
      // POSITIVE: low score = high risk (Controle, Apoio Chefia, Apoio Colegas, Cargo, Comunicação)
      for (const t of RISK_THRESHOLDS_POSITIVE) {
        if (score <= t.max) return t.level as RiskLevel;
      }
      return 'aceitavel';
    }
  }

  // Calculate NR value: probability × severity
  // Severity depends on risk classification: crítico = 4, others = 2
  // dimensionKey kept for backward compatibility but no longer used.
  static calculateNR(riskLevel: RiskLevel, _dimensionKey?: string): number {
    const probability = NR_PROBABILITY[riskLevel];
    const severity = riskLevel === 'critico' ? 4 : 2;
    return probability * severity;
  }

  // Interpret NR value — possible values: 2 (baixo), 4 (médio), 6 (moderado), 16 (alto)
  static interpretNR(nr: number): { label: string; color: string } {
    if (nr <= 2)  return { label: 'Risco Baixo',    color: RISK_COLORS.aceitavel };
    if (nr <= 4)  return { label: 'Risco Médio',    color: RISK_COLORS.moderado };
    if (nr <= 6)  return { label: 'Risco Moderado', color: RISK_COLORS.importante };
    return           { label: 'Risco Alto',      color: RISK_COLORS.critico };
  }

  // Calculate IGRP = mean of all 7 dimension NR values (range 1–16)
  static calculateIGRP(dimensionScores: Record<DimensionType, number>): number {
    let totalNR = 0;
    let count = 0;
    for (const dim of HSE_DIMENSIONS) {
      const score = dimensionScores[dim.key as DimensionType] ?? 0;
      const risk = this.getRiskLevel(score, dim.type);
      const nr = this.calculateNR(risk, dim.key);
      totalNR += nr;
      count++;
    }
    return Number((totalNR / count).toFixed(2));
  }

  // Returns true if NR >= 6 (Risco Moderado or Risco Alto)
  static isHighRisk(nr: number): boolean {
    return nr >= 6;
  }
}
