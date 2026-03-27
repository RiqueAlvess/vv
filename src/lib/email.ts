import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('Missing RESEND_API_KEY environment variable');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

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
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'Asta <noreply@seu-dominio.com.br>',
      to: params.to,
      subject: `Pesquisa de Clima Organizacional — ${params.companyName}`,
      html: buildEmailHtml(params),
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Email] Unexpected error:', err);
    return null;
  }
}

function buildEmailHtml(params: SendSurveyInvitationParams): string {
  const expires = params.expiresAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #1e3a5f; padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Pesquisa de Riscos Psicossociais</h1>
      <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">${params.companyName}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        Você foi convidado(a) a participar da pesquisa <strong>${params.campaignName}</strong>, realizada em conformidade com a NR-1.
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Sua participação é <strong>completamente anônima</strong>. As respostas não permitem sua identificação individual — isso é garantido tecnicamente, não apenas por política.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.surveyUrl}"
           style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
          Responder Pesquisa
        </a>
      </div>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-top: 24px;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          &#9201; Este link expira em <strong>${expires}</strong> e pode ser usado apenas uma vez.<br>
          &#128274; Em conformidade com a LGPD — Lei n&#186; 13.709/2018 e NR-1 / Portaria MTE n&#186; 1.419/2024.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
