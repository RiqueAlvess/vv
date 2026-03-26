'use server';

import { prisma } from '@/lib/prisma';
import { AnonymityService } from '@/services/anonymity.service';
import { ScoreService } from '@/services/score.service';
import { surveyResponseSchema } from '@/lib/validations';
import { HSE_DIMENSIONS } from '@/lib/constants';
import type { DimensionType } from '@/types';

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function err(error: string): Err { return { success: false, error }; }

// ─── Step 3 of the Blind Drop Protocol ────────────────────────────────────

/**
 * Validates the public survey token and destroys it atomically.
 * After this call the token is null — it can never be used to link an
 * invitation to a response. Returns an anonymous session UUID.
 *
 * This is a PUBLIC action — no authentication required.
 */
export async function validateSurveyToken(token: string): Promise<
  Result<{ sessionUuid: string; campaignId: string }>
> {
  if (!token || typeof token !== 'string') return err('Token inválido');

  const result = await AnonymityService.validateAndDestroyToken(token);
  if (!result) return err('Link inválido, expirado ou já utilizado');

  // Schedule the delayed invitation status update (step 5 — temporal de-correlation)
  const delayMs = AnonymityService.calculateRandomDelay();
  await AnonymityService.scheduleStatusUpdate(result.invitationId, delayMs);

  return ok({ sessionUuid: result.sessionUuid, campaignId: result.campaignId });
}

// ─── Step 4 of the Blind Drop Protocol ────────────────────────────────────

/**
 * Persists an anonymous survey response.
 * The response has NO foreign key to the invitation or employee.
 * After saving, fires scoring and writes FactResponse rows.
 *
 * This is a PUBLIC action — no authentication required.
 */
export async function submitSurveyResponse(input: {
  campaignId: string;
  sessionUuid: string;
  responses: Record<string, number>;
  gender?: string;
  age_range?: string;
  consent_accepted: true;
}): Promise<Result<{ id: string }>> {
  const parsed = surveyResponseSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

  // Verify campaign is still active
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { status: true },
  });
  if (!campaign) return err('Campanha não encontrada');
  if (campaign.status !== 'active') return err('Esta campanha não está aceitando respostas');

  // Guard: one response per session UUID
  const existing = await prisma.surveyResponse.findFirst({
    where: { session_uuid: input.sessionUuid },
    select: { id: true },
  });
  if (existing) return err('Resposta já registrada para esta sessão');

  const payload = AnonymityService.buildAnonymousResponse(
    input.campaignId,
    input.sessionUuid,
    input.responses,
    { gender: input.gender, ageRange: input.age_range },
    input.consent_accepted
  );

  const response = await prisma.surveyResponse.create({
    data: payload,
    select: { id: true },
  });

  // Write FactResponse rows (analytics star schema)
  await persistFactResponses(response.id, input.campaignId, input.responses);

  return ok({ id: response.id });
}

// ─── Pure analytics helper ─────────────────────────────────────────────────

/**
 * Computes per-dimension scores + risk levels and writes them to fact_responses.
 * Pure function — no auth, no side effects beyond the DB write.
 */
async function persistFactResponses(
  responseId: string,
  campaignId: string,
  responses: Record<string, number>
): Promise<void> {
  const dimensionScores = ScoreService.calculateAllDimensionScores(responses);

  const facts = HSE_DIMENSIONS.map((dim) => {
    const score = dimensionScores[dim.key as DimensionType];
    const riskLevel = ScoreService.getRiskLevel(score, dim.type);
    const nrValue = ScoreService.calculateNR(riskLevel);
    return {
      campaign_id: campaignId,
      response_id: responseId,
      dimension: dim.key,
      score,
      risk_level: riskLevel,
      nr_value: nrValue,
    };
  });

  await prisma.factResponse.createMany({ data: facts });
}

// ─── Public survey data fetch ──────────────────────────────────────────────

/**
 * Returns the questions list for rendering the survey form.
 * Public — no auth required.
 */
export async function getSurveyQuestions(): Promise<Result<unknown[]>> {
  const questions = await prisma.surveyQuestion.findMany({
    where: { active: true },
    orderBy: { question_number: 'asc' },
    select: { id: true, question_number: true, dimension: true, question_text: true },
  });

  return ok(questions);
}
