'use server';

import { prisma } from '@/lib/prisma';
import { calculateHSEITScores } from '@/lib/scoring';

// ─── Result type ────────────────────────────────────────────────────────────

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }

/** Returns the active questions list for rendering the survey form. */
export async function getSurveyQuestions(): Promise<Result<unknown[]>> {
  const questions = await prisma.surveyQuestion.findMany({
    where: { active: true },
    orderBy: { question_number: 'asc' },
    select: { id: true, question_number: true, dimension: true, question_text: true },
  });
  return ok(questions);
}

/**
 * Computes per-dimension HSE-IT scores from raw answers and writes
 * FactResponse rows to the analytics star schema.
 */
export async function persistFactResponses(
  responseId: string,
  campaignId: string,
  answers: Record<string, number>
): Promise<void> {
  const { dimensions } = calculateHSEITScores(answers);

  await prisma.factResponse.createMany({
    data: dimensions.map((d) => ({
      campaign_id: campaignId,
      response_id: responseId,
      dimension: d.key,
      score: d.rawScore,
      risk_level: d.riskLevel,
      nr_value: d.nrValue,
    })),
  });
}
