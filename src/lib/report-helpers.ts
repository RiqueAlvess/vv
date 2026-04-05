/**
 * Report computation helpers — extracted for testability.
 * (Next.js route files cannot export non-HTTP handler functions.)
 */
import {
  HSE_DIMENSIONS,
  RISK_THRESHOLDS_NEGATIVE,
  NR_MATRIX,
} from '@/lib/constants';
import type { RiskLevel } from '@/types';

export function getRiskLevel(score: number, type: 'positive' | 'negative'): RiskLevel {
  const normalized = type === 'positive' ? 4 - score : score;
  for (const threshold of RISK_THRESHOLDS_NEGATIVE) {
    if (normalized >= threshold.min) return threshold.level;
  }
  return 'aceitavel';
}

export function calculateNR(riskLevel: RiskLevel): number {
  return NR_MATRIX[riskLevel].probability * NR_MATRIX.default_severity;
}

/**
 * Computes campaign-wide dimension scores from an array of survey response answer maps.
 * Iterates over all responses once per dimension — O(responses × questions_total).
 * Returns an empty object when the responses array is empty.
 */
export function computeDimensions(
  responses: Record<string, number>[]
): Record<string, { score: number; risk: RiskLevel; nr: number }> {
  if (responses.length === 0) return {};

  const result: Record<string, { score: number; risk: RiskLevel; nr: number }> = {};

  for (const dim of HSE_DIMENSIONS) {
    let totalScore = 0;
    let count = 0;

    for (const response of responses) {
      for (const qn of dim.questionNumbers) {
        const key = `q${qn}`;
        if (response[key] !== undefined) {
          const raw = response[key];
          const normalizedLikert = raw > 4 ? raw - 1 : raw;
          totalScore += normalizedLikert;
          count++;
        }
      }
    }

    const avg = count > 0 ? totalScore / count : 0;
    const roundedAvg = Math.round(avg * 100) / 100;
    const risk = getRiskLevel(roundedAvg, dim.type);
    const nr = calculateNR(risk);

    result[dim.key] = { score: roundedAvg, risk, nr };
  }

  return result;
}
