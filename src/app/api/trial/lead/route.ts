import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const leadSchema = z.object({
  name:          z.string().min(1),
  email:         z.string().email(),
  phone:         z.string().optional(),
  companyName:   z.string().min(1),
  companySize:   z.string().min(1),
  sector:        z.string().optional(),
  role:          z.string().optional(),
  painPoints:    z.array(z.string()).optional().default([]),
  interest:      z.number().int().min(1).max(10),
  message:       z.string().optional(),
  trial_responses: z.string().nullable().optional(),
  analytics:     z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;

  let analyticsJson: unknown = null;
  try { if (d.analytics) analyticsJson = JSON.parse(d.analytics); } catch { /* noop */ }

  try {
    await prisma.trialLead.create({
      data: {
        name:         d.name,
        email:        d.email,
        phone:        d.phone ?? null,
        company_name: d.companyName,
        company_size: d.companySize,
        sector:       d.sector ?? null,
        role:         d.role ?? null,
        pain_points:  d.painPoints,
        interest:     d.interest,
        message:      d.message ?? null,
        analytics:    analyticsJson ?? undefined,
      },
    });
  } catch (err) {
    console.error('[trial/lead] db save failed', err);
    // Continue — don't fail the request if DB is unavailable
  }

  // Notify via Resend if configured
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.TRIAL_LEAD_EMAIL ?? process.env.EMAIL_FROM;

  if (resendKey && adminEmail) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      const painList = d.painPoints.length
        ? d.painPoints.map((p: string) => `<li>${p}</li>`).join('')
        : '<li>—</li>';
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? 'noreply@vivamente360.com.br',
        to:   adminEmail.replace(/.*<(.+)>/, '$1').trim(),
        subject: `[Trial Lead] ${d.name} · ${d.companyName} · Interesse ${d.interest}/10`,
        html: `
          <h2 style="color:#144660">Novo Lead — VIVAMENTE360 Trial</h2>
          <table cellpadding="4">
            <tr><td><b>Nome</b></td><td>${d.name}</td></tr>
            <tr><td><b>E-mail</b></td><td>${d.email}</td></tr>
            <tr><td><b>WhatsApp</b></td><td>${d.phone ?? '—'}</td></tr>
            <tr><td><b>Empresa</b></td><td>${d.companyName}</td></tr>
            <tr><td><b>Porte</b></td><td>${d.companySize}</td></tr>
            <tr><td><b>Setor</b></td><td>${d.sector ?? '—'}</td></tr>
            <tr><td><b>Cargo</b></td><td>${d.role ?? '—'}</td></tr>
            <tr><td><b>Interesse</b></td><td><b style="color:#009B00">${d.interest}/10</b></td></tr>
            <tr><td><b>Mensagem</b></td><td>${d.message ?? '—'}</td></tr>
          </table>
          <h3>Dores relatadas</h3><ul>${painList}</ul>
        `,
      });
    } catch (err) {
      console.error('[trial/lead] email send failed', err);
    }
  }

  return NextResponse.json({ ok: true });
}
