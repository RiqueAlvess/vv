import { generateToken } from '@/lib/crypto';

/**
 * Anonymity helpers for the QR Code based survey flow.
 *
 * In the QR code model, anonymity is guaranteed by:
 * 1. No per-person tokens — a single QR code is shared with the entire group
 * 2. Hierarchy is self-reported by the respondent (not derived from identity)
 * 3. Fingerprint is a one-way device hash stored only to prevent duplicate submissions
 * 4. SurveyResponse has NO FK to any identity record (campaign_id + session_uuid only)
 */
export class AnonymityService {
  /** Generate a random anonymous session UUID for a survey response. */
  static generateSessionUuid(): string {
    return generateToken();
  }

  /** Build an anonymous response payload — strip ALL identifiers */
  static buildAnonymousResponse(
    campaignId: string,
    sessionUuid: string,
    responses: Record<string, number>,
    demographics: {
      gender?: string | null;
      ageRange?: string | null;
      unitId?: string | null;
      sectorId?: string | null;
      positionId?: string | null;
      fingerprint?: string | null;
    },
    consentAccepted: boolean
  ) {
    return {
      campaign_id: campaignId,
      session_uuid: sessionUuid,
      unit_id: demographics.unitId ?? null,
      sector_id: demographics.sectorId ?? null,
      position_id: demographics.positionId ?? null,
      fingerprint: demographics.fingerprint ?? null,
      gender: demographics.gender ?? null,
      age_range: demographics.ageRange ?? null,
      consent_accepted: consentAccepted,
      consent_accepted_at: new Date(),
      responses,
    };
  }
}
