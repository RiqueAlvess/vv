import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const itemId = formData.get('item_id') as string | null;
  const campaignId = formData.get('campaign_id') as string | null;

  if (!file || !itemId || !campaignId) {
    return NextResponse.json({ error: 'file, item_id e campaign_id sao obrigatorios' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande (max 10MB)' }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { company_id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha nao encontrada' }, { status: 404 });
  if (user.role === 'RH' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let checklist = await prisma.checklistProgress.findUnique({
    where: { campaign_id: campaignId },
    select: { id: true },
  });
  if (!checklist) {
    checklist = await prisma.checklistProgress.create({
      data: { campaign_id: campaignId, checked_items: [] },
      select: { id: true },
    });
  }

  const supabase = createServerClient();
  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${campaignId}/${itemId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('checklist-evidences')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    const message = uploadError.message?.includes('Bucket not found')
      ? 'Storage bucket nao configurado. Crie o bucket "checklist-evidences" no Supabase.'
      : 'Erro ao fazer upload do arquivo';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('checklist-evidences')
    .getPublicUrl(storagePath);

  const evidence = await prisma.checklistEvidence.create({
    data: {
      checklist_id: checklist.id,
      item_id: itemId,
      file_name: file.name,
      file_url: publicUrl,
      file_type: file.type,
    },
    select: {
      id: true, item_id: true, file_name: true,
      file_url: true, file_type: true, uploaded_at: true,
    },
  });

  return NextResponse.json(evidence, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const evidenceId = url.pathname.split('/').pop();

  if (!evidenceId) {
    return NextResponse.json({ error: 'evidence id obrigatorio' }, { status: 400 });
  }

  const evidence = await prisma.checklistEvidence.findUnique({
    where: { id: evidenceId },
    include: {
      checklist: { select: { campaign: { select: { company_id: true } } } },
    },
  });

  if (!evidence) return NextResponse.json({ error: 'Evidencia nao encontrada' }, { status: 404 });
  if (user.role === 'RH' && evidence.checklist.campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.checklistEvidence.delete({ where: { id: evidenceId } });
  return NextResponse.json({ ok: true });
}
