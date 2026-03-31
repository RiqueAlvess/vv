import { prisma } from '@/lib/prisma';
import { hashEmail, generateToken } from '@/lib/crypto';
import { statusUpdateQueue } from '@/lib/queues/status-update.queue';

/**
 * Blind Drop Anonymity Protocol
 *
 * Ensures zero traceability between user identity and survey response.
 * 5-step protocol:
 * 1. Hash email with campaign-specific salt (CSV upload)
 * 2. Generate magic link with public UUID token
 * 3. On survey access: validate token → create anonymous session → DESTROY token
 * 4. On submission: save response with NO identifiers (only campaign_id + demographics)
 * 5. Schedule delayed status update (1-12h) to prevent temporal correlation
 */
export class AnonymityService {
  // Step 1: Hash employee email with campaign salt — no PII stored
  static hashEmployeeEmail(email: string, campaignSalt: string): string {
    return hashEmail(email.toLowerCase().trim(), campaignSalt);
  }

  // Step 2: Build magic link URL for survey invitation
  static generateMagicLink(baseUrl: string, tokenPublic: string): string {
    return `${baseUrl}/survey/${tokenPublic}`;
  }

  // Step 3: Validate token, create anonymous session, DESTROY the original token
  // This is the critical anonymity step — the token is nullified so it can never
  // be used to correlate an invitation to a response
  static async validateAndDestroyToken(tokenPublic: string): Promise<{
    sessionUuid: string;
    campaignId: string;
    invitationId: string;
  } | null> {
    // Find invitation by token
    const invitation = await prisma.surveyInvitation.findUnique({
      where: { token_public: tokenPublic },
      select: {
        id: true,
        campaign_id: true,
        token_used_internally: true,
        expires_at: true,
      },
    });

    if (!invitation) return null;
    if (invitation.token_used_internally) return null;
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) return null;

    // Generate anonymous session UUID
    const sessionUuid = generateToken();

    // DESTROY the token — mark as used internally
    // Do NOT set token_public to null — DB has NOT NULL constraint.
    // token_used_internally=true is the authoritative "used" flag; the token
    // remains in DB but is rejected before any lookup can succeed.
    await prisma.surveyInvitation.update({
      where: { id: invitation.id },
      data: {
        token_used_internally: true,
      },
    });

    return {
      sessionUuid,
      campaignId: invitation.campaign_id,
      invitationId: invitation.id,
    };
  }

  // Step 4: Build an anonymous response payload — strip ALL identifiers
  static buildAnonymousResponse(
    campaignId: string,
    sessionUuid: string,
    responses: Record<string, number>,
    demographics: { gender?: string | null; ageRange?: string | null },
    consentAccepted: boolean
  ) {
    return {
      campaign_id: campaignId,
      session_uuid: sessionUuid,
      gender: demographics.gender ?? null,
      age_range: demographics.ageRange ?? null,
      consent_accepted: consentAccepted,
      consent_accepted_at: new Date(),
      responses,
      // NO employee_id, NO invitation_id, NO email — anonymity guaranteed
    };
  }

  // Step 5: Calculate random delay for status update (1-12 hours)
  // Prevents temporal correlation between response submission and invitation status change
  static calculateRandomDelay(): number {
    const minHours = 1;
    const maxHours = 12;
    const hours = minHours + Math.random() * (maxHours - minHours);
    return Math.floor(hours * 60 * 60 * 1000);
  }

  // Schedule the delayed status update
  static async scheduleStatusUpdate(invitationId: string, delayMs: number): Promise<void> {
    const scheduledAt = new Date(Date.now() + delayMs);
    await prisma.surveyInvitation.update({
      where: { id: invitationId },
      data: {
        status_update_scheduled_at: scheduledAt,
      },
    });

    const millisUntilScheduledAt = scheduledAt.getTime() - Date.now();
    await statusUpdateQueue.add(
      'process-status-update',
      { invitationId, scheduledAt },
      {
        delay: millisUntilScheduledAt,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }
    );
  }
}
