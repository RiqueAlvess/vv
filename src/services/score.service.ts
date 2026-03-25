import { HSE_DIMENSIONS, RISK_THRESHOLDS_NEGATIVE, RISK_THRESHOLDS_POSITIVE, NR_MATRIX, NR_INTERPRETATION } from '@/lib/constants';
import { DimensionType, RiskLevel } from '@/types';

export class ScoreService {
  // Calculate score for a single dimension from a response's answers
  static calculateDimensionScore(responses: Record<string, number>, dimension: DimensionType): number {
    const dim = HSE_DIMENSIONS.find(d => d.key === dimension);
    if (!dim) return 0;
    const questionKeys = dim.questionNumbers.map(n => `q${n}`);
    const values = questionKeys.map(k => responses[k] ?? 0);
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
      // High score = high risk for negative dimensions
      for (const t of RISK_THRESHOLDS_NEGATIVE) {
        if (score >= t.min) return t.level as RiskLevel;
      }
      return 'aceitavel';
    } else {
      // Low score = high risk for positive dimensions
      for (const t of RISK_THRESHOLDS_POSITIVE) {
        if (score <= t.max) return t.level as RiskLevel;
      }
      return 'aceitavel';
    }
  }

  // Calculate NR value: probability × severity
  static calculateNR(riskLevel: RiskLevel, severity: number = NR_MATRIX.default_severity): number {
    const probability = NR_MATRIX[riskLevel].probability;
    return probability * severity;
  }

  // Interpret NR value
  static interpretNR(nr: number): { label: string; color: string } {
    for (const interp of NR_INTERPRETATION) {
      if (nr <= interp.maxNR) return { label: interp.label, color: interp.color };
    }
    return { label: 'Crítico', color: '#ef4444' };
  }

  // Calculate IGRP (general psychosocial risk index) - weighted average of all dimension NRs
  static calculateIGRP(dimensionScores: Record<DimensionType, number>): number {
    let totalNR = 0;
    let count = 0;
    for (const dim of HSE_DIMENSIONS) {
      const score = dimensionScores[dim.key as DimensionType];
      const risk = this.getRiskLevel(score, dim.type);
      const nr = this.calculateNR(risk);
      totalNR += nr;
      count++;
    }
    return Number((totalNR / count).toFixed(2));
  }
}
