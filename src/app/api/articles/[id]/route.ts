import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().optional(),
  cover_url: z.string().optional().nullable().transform(v => v || null),
  pinned: z.boolean().optional(),
  published: z.boolean().optional(),
});

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const article = await prisma.article.findUnique({
    where: { id },
    include: { author: { select: { name: true } } },
  });

  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!article.published && user.role !== 'ADM') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(article);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const article = await prisma.article.update({
    where: { id },
    data: { ...parsed.data, updated_at: new Date() },
    select: { id: true, title: true, slug: true, pinned: true, published: true },
  });

  return NextResponse.json(article);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.article.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
