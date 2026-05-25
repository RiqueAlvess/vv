import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const leadSchema = z.object({
  name:          z.string().min(1),
  email:         z.string().email(),
  phone:         z.string().optional(),
  companyName:   z.string().min(1),
  companySize:   z.string().min(1),
  sector:        z.string().optional(),
  role:          z.string().optional(),
  painPoints:    z.array(z.string()).optional(),
  interest:      z.number().int().min(1).max(10),
  message:       z.string().optional(),
  trial_responses: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  const lead = parsed.data;

  // Log the lead for now — extend to DB / CRM / email as needed
  console.log('[trial/lead]', {
    name:        lead.name,
    email:       lead.email,
    company:     lead.companyName,
    size:        lead.companySize,
    interest:    lead.interest,
    painPoints:  lead.painPoints,
    receivedAt:  new Date().toISOString(),
  });

  // Optionally send a notification via Resend when key is available
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.TRIAL_LEAD_EMAIL ?? process.env.EMAIL_FROM;

  if (resendKey && adminEmail) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      const painList = lead.painPoints?.length
        ? lead.painPoints.map((p: string) => `<li>${p}</li>`).join('')
        : '<li>—</li>';

      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? 'noreply@vivamente360.com.br',
        to:   adminEmail.replace(/.*<(.+)>/, '$1').trim(),
        subject: `[Trial Lead] ${lead.name} · ${lead.companyName} · Interesse ${lead.interest}/10`,
        html: `
          <h2 style="color:#144660">Novo Lead — VIVAMENTE360 Trial</h2>
          <table>
            <tr><td><b>Nome</b></td><td>${lead.name}</td></tr>
            <tr><td><b>E-mail</b></td><td>${lead.email}</td></tr>
            <tr><td><b>WhatsApp</b></td><td>${lead.phone ?? '—'}</td></tr>
            <tr><td><b>Empresa</b></td><td>${lead.companyName}</td></tr>
            <tr><td><b>Porte</b></td><td>${lead.companySize}</td></tr>
            <tr><td><b>Setor</b></td><td>${lead.sector ?? '—'}</td></tr>
            <tr><td><b>Cargo</b></td><td>${lead.role ?? '—'}</td></tr>
            <tr><td><b>Interesse</b></td><td><b style="color:#009B00">${lead.interest}/10</b></td></tr>
            <tr><td><b>Mensagem</b></td><td>${lead.message ?? '—'}</td></tr>
          </table>
          <h3>Dores relatadas</h3>
          <ul>${painList}</ul>
        `,
      });
    } catch (err) {
      console.error('[trial/lead] email send failed', err);
    }
  }

  return NextResponse.json({ ok: true });
}
