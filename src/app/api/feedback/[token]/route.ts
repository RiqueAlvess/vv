import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

interface RouteParams { params: Promise<{ token: string }> }

const feedbackSchema = z.object({
  type: z.enum(['positivo', 'negativo', 'sugestao', 'outro']),
  category: z.enum([
    'lideranca', 'carga_trabalho', 'relacionamentos',
    'comunicacao', 'beneficios', 'ambiente', 'outro',
  ]).optional(),
  message: z.string()
    .min(10, 'Mensagem deve ter no mínimo 10 caracteres')
    .max(2000, 'Mensagem deve ter no máximo 2000 caracteres'),
});

// GET — validate token and get company name (for the public form)
export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;

  const channel = await prisma.companyFeedbackChannel.findUnique({
    where: { public_token: token },
    select: {
      id: true,
      active: true,
      company: { select: { name: true } },
    },
  });

  if (!channel || !channel.active) {
    return NextResponse.json({ valid: false, error: 'Canal não encontrado ou inativo' }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    company_name: channel.company.name,
  });
}

// POST — submit anonymous feedback (no auth required)
export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;

  const channel = await prisma.companyFeedbackChannel.findUnique({
    where: { public_token: token },
    select: { id: true, active: true },
  });

  if (!channel || !channel.active) {
    return NextResponse.json({ error: 'Canal não encontrado ou inativo' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // NO IP, NO identity stored — message only
  await prisma.anonymousFeedback.create({
    data: {
      channel_id: channel.id,
      type: parsed.data.type,
      category: parsed.data.category ?? null,
      message: parsed.data.message,
    },
  });

  return NextResponse.json({ success: true, message: 'Feedback enviado com sucesso' });
}
