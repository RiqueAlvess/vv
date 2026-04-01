import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.DEFAULT_FROM_EMAIL;
if (!fromEmail) {
  throw new Error('DEFAULT_FROM_EMAIL environment variable is required');
}
const FROM = fromEmail;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function buildSurveyUrl(token: string): string {
  return `${BASE_URL}/survey/${token}`;
}

export async function sendInvitationEmail(params: {
  to: string;
  campaignName: string;
  companyName: string;
  token: string;
  expiresAt: Date;
}): Promise<boolean> {
  const surveyUrl = buildSurveyUrl(params.token);
  const expiresFormatted = params.expiresAt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Pesquisa de Clima — ${params.companyName}`,
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para Pesquisa</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="background:#1e3a5f;padding:32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:600;letter-spacing:-0.3px;">
                Pesquisa de Riscos Psicossociais
              </h1>
              <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">${params.companyName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#1e293b;font-size:15px;line-height:1.7;margin:0 0 16px;">
                Você foi convidado(a) a participar da pesquisa <strong>${params.campaignName}</strong>,
                realizada em conformidade com a <strong>NR-1</strong> (Portaria MTE nº 1.419/2024).
              </p>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px;">
                Sua participação é <strong>completamente anônima</strong>. As respostas são armazenadas
                sem qualquer vínculo com sua identidade — isso é garantido tecnicamente (arquitetura Blind-Drop),
                não apenas por política.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${surveyUrl}"
                       style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.1px;">
                      Responder Pesquisa →
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f1f5f9;border-radius:8px;padding:16px;">
                    <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                      Este link expira em <strong>${expiresFormatted}</strong> e pode ser usado apenas uma vez.<br>
                      Participação voluntária — conforme LGPD (Lei nº 13.709/2018).<br>
                      Se você recebeu este email por engano, pode ignorá-lo com segurança.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="color:#94a3b8;font-size:11px;margin:0;">
                Asta — Plataforma de Análise de Riscos Psicossociais NR-1
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    if (error) {
      console.error('[Email] Resend error:', JSON.stringify(error));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Email] Unexpected error:', err);
    return false;
  }
}

// Legacy function used by send-invitations route
export interface SendSurveyInvitationParams {
  to: string;
  campaignName: string;
  companyName: string;
  surveyUrl: string;
  expiresAt: Date;
}

export async function sendSurveyInvitation(
  params: SendSurveyInvitationParams
): Promise<{ id: string } | null> {
  const token = params.surveyUrl.split('/survey/')[1];
  if (!token) return null;
  const ok = await sendInvitationEmail({
    to: params.to,
    campaignName: params.campaignName,
    companyName: params.companyName,
    token,
    expiresAt: params.expiresAt,
  });
  return ok ? { id: 'sent' } : null;
}
