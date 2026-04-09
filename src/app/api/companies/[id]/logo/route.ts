import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const BUCKET = 'company-logos';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id, active: true },
      select: { id: true, logo_url: true },
    });
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 5 MB)' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato inválido. Use JPEG, PNG, WebP ou SVG' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${id}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createServerClient();

    // Remove old logo if it exists
    if (company.logo_url) {
      const oldPath = company.logo_url.split(`/${BUCKET}/`)[1];
      if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
    if (uploadError) {
      console.error('Logo upload error:', uploadError);
      return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const logo_url = urlData.publicUrl;

    await prisma.company.update({
      where: { id },
      data: { logo_url, updated_at: new Date() },
    });

    return NextResponse.json({ logo_url });
  } catch (err) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id, active: true },
      select: { id: true, logo_url: true },
    });
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    if (company.logo_url) {
      const supabase = createServerClient();
      const path = company.logo_url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }

    await prisma.company.update({
      where: { id },
      data: { logo_url: null, updated_at: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Logo delete error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
