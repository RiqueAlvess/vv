'use server';

import { prisma } from '@/lib/prisma';
import { statusUpdateQueue } from '@/lib/queue';
import { generateToken } from '@/lib/crypto';
import { calculateHSEITScores } from '@/lib/scoring';
import { surveyResponseSchema } from '@/lib/validations';

// ─── Result type ────────────────────────────────────────────────────────────

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> { return { success: true, data }; }
function err(error: string): Err { return { success: false, error }; }

// ─── TASK 1: Blind Drop — single atomic submission ─────────────────────────

/**
 * The complete survey submission pipeline — all 5 steps in one Server Action.
 *
 * This is intentionally a combined operation: the client should NEVER need to
 * call a separate "validate token" step first, because that would burn the
 * token while leaving the window open for the response to fail.
 *
 * Step 1 (CSV import) and Step 2 (email send) happen upstream.
 * Steps 3-5 happen here:
 *
 *   Step 3 — Validate token → create anonymous session UUID → DESTROY token
 *            (all inside a DB transaction so token burn and session creation are atomic)
 *   Step 4 — Save SurveyResponse with zero identifiers (no invitation FK, no email)
 *   Step 5 — Enqueue BullMQ job with random 1–12 h jitter to mark invitation
 *            as 'completed'. The HR panel polls invitation status, but the delay
 *            makes it impossible to correlate "response submitted at T" with
 *            "invitation flipped at T + epsilon".
 */
export async function submitSurveyResponse(input: {
  publicToken: string;
  answers: Record<string, number>;
  gender?: string;
  ageRange?: string;
  consentAccepted: true;
}): Promise<Result<{ responseId: string }>> {
  // ── Validate input shape ──────────────────────────────────────────────────
  const parsed = surveyResponseSchema.safeParse({
    responses: input.answers,
    gender: input.gender,
    age_range: input.ageRange,
    consent_accepted: input.consentAccepted,
  });
  if (!parsed.success) return err(parsed.error.issues[0].message);

  // ── Step 3: Validate + atomically destroy token ───────────────────────────
  // We do this inside a transaction so that if the response INSERT fails we
  // can still roll back the token invalidation, giving the user a chance to retry.
  let campaignId: string;
  let invitationId: string;
  let sessionUuid: string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find the invitation by its public token
      const invitation = await tx.surveyInvitation.findUnique({
        where: { token_public: input.publicToken },
        select: {
          id: true,
          campaign_id: true,
          token_used_internally: true,
          expires_at: true,
          campaign: { select: { status: true } },
        },
      });

      if (!invitation) throw new SubmissionError('Link inválido ou já utilizado');
      if (invitation.token_used_internally) throw new SubmissionError('Este convite já foi utilizado');
      if (invitation.expires_at && invitation.expires_at < new Date()) {
        throw new SubmissionError('Este convite expirou');
      }
      if (invitation.campaign.status !== 'active') {
        throw new SubmissionError('Esta campanha não está aceitando respostas no momento');
      }

      // DESTROY the token — after this line no query can link the invitation to a response
      await tx.surveyInvitation.update({
        where: { id: invitation.id },
        data: {
          token_public: null,           // token is gone — unreachable forever
          token_used_internally: true,  // guard for double-submit race conditions
        },
      });

      // Generate anonymous session UUID — the only link between steps 3 and 4,
      // and it is never stored anywhere with an identity reference.
      const uuid = generateToken();

      // Step 4: Save anonymous response — NO FK to invitation or employee
      const response = await tx.surveyResponse.create({
        data: {
          campaign_id: invitation.campaign_id,
          session_uuid: uuid,
          gender: input.gender ?? null,
          age_range: input.ageRange ?? null,
          consent_accepted: true,
          consent_accepted_at: new Date(),
          responses: parsed.data.responses,
        },
        select: { id: true },
      });

      return {
        campaignId: invitation.campaign_id,
        invitationId: invitation.id,
        sessionUuid: uuid,
        responseId: response.id,
      };
    });

    campaignId = result.campaignId;
    invitationId = result.invitationId;
    sessionUuid = result.sessionUuid;

    // Write per-dimension FactResponse rows (outside the transaction — non-critical)
    await persistFactResponses(result.responseId, campaignId, parsed.data.responses);

    // ── Step 5: Enqueue delayed status update ─────────────────────────────
    // Random 1–12 hour jitter. This is the key mechanism that prevents temporal
    // correlation: an observer who can see both "response saved at T" and
    // "invitation marked complete at T+X" cannot determine if X was caused by
    // this specific response without breaking the hash function.
    const delayMs = randomJitterMs(1, 12);
    await enqueueStatusUpdate(invitationId, delayMs);

    return ok({ responseId: result.responseId });
  } catch (e) {
    if (e instanceof SubmissionError) return err(e.message);
    console.error('[submitSurveyResponse] unexpected error:', e);
    return err('Erro ao registrar resposta. Tente novamente.');
  }
}

// ─── Public helpers (no auth required) ────────────────────────────────────

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
 * Lightweight check: is the token still valid?
 * Does NOT destroy the token — use only to show the survey UI.
 * The token is destroyed only when the user actually submits.
 */
export async function checkSurveyToken(
  publicToken: string
): Promise<Result<{ campaignId: string }>> {
  const invitation = await prisma.surveyInvitation.findUnique({
    where: { token_public: publicToken },
    select: {
      campaign_id: true,
      token_used_internally: true,
      expires_at: true,
      campaign: { select: { status: true } },
    },
  });

  if (!invitation) return err('Link inválido ou já utilizado');
  if (invitation.token_used_internally) return err('Este convite já foi utilizado');
  if (invitation.expires_at && invitation.expires_at < new Date()) return err('Este convite expirou');
  if (invitation.campaign.status !== 'active') return err('Esta campanha não está mais ativa');

  return ok({ campaignId: invitation.campaign_id });
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

/** Random jitter between minHours and maxHours converted to milliseconds. */
function randomJitterMs(minHours: number, maxHours: number): number {
  const hours = minHours + Math.random() * (maxHours - minHours);
  return Math.floor(hours * 60 * 60 * 1000);
}

/**
 * Enqueues a BullMQ job that will flip SurveyInvitation.status → 'completed'
 * after the jitter delay expires. The worker is in src/workers/index.ts.
 *
 * Job options:
 * - delay: the jitter ms — BullMQ will not process until this elapses
 * - attempts: 3 retries with exponential backoff in case Redis or DB is briefly unavailable
 * - jobId: deduplicated on invitationId so double-enqueue is safe
 */
async function enqueueStatusUpdate(invitationId: string, delayMs: number): Promise<void> {
  await statusUpdateQueue.add(
    'update-status',
    { invitationId },
    {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      jobId: `status-${invitationId}`, // deduplication key
    }
  );
}

/**
 * Computes per-dimension HSE-IT scores from raw answers and writes
 * FactResponse rows to the analytics star schema.
 */
async function persistFactResponses(
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

/** Typed error to distinguish domain errors from unexpected crashes. */
class SubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionError';
  }
}
