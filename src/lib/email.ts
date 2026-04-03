// Email sending removed — platform now uses QR Code based survey access.
// This file is kept as a stub to avoid breaking any stale imports.

export async function sendInvitationEmail(_opts: unknown): Promise<boolean> {
  console.warn('[email] sendInvitationEmail called but email sending is disabled');
  return false;
}

export async function sendSurveyInvitation(_opts: unknown): Promise<boolean> {
  return false;
}
