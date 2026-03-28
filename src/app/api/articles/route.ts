import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const articleSchema = z.object({
  title: z.string().min(3, 'Titulo deve ter no minimo 3 caracteres').max(200),
  content: z.string().min(1, 'Conteudo nao pode ser vazio'),
  cover_url: z.string().optional().nullable().transform(v => v || null),
  pinned: z.boolean().optional().default(false),
  published: z.boolean().optional().default(true),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '12'));
  const offset = (page - 1) * limit;

  // ADM sees all (including unpublished), others see only published
  const where = user.role === 'ADM' ? {} : { published: true };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }],
      skip: offset,
      take: limit,
      select: {
        id: true, title: true, slug: true, cover_url: true,
        pinned: true, published: true, created_at: true,
        content: true,
        author: { select: { name: true } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({ data: articles, total, page, limit });
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Article validation error:', parsed.error.issues);
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { title, content, cover_url, pinned = false, published = true } = parsed.data;

  // Generate unique slug
  let slug = slugify(title);
  const existing = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const article = await prisma.article.create({
    data: {
      title, slug, content,
      cover_url: cover_url || null,
      pinned, published,
      author_id: user.user_id,
    },
    select: { id: true, title: true, slug: true },
  });

  return NextResponse.json(article, { status: 201 });
}
