import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CHECKLIST_BUCKET = 'checklist-vivamente';

function extractStoragePath(fileUrl: string): string | null {
  const marker = `/storage/v1/object/public/${CHECKLIST_BUCKET}/`;
  const markerIndex = fileUrl.indexOf(marker);
  if (markerIndex === -1) return null;
  const path = fileUrl.slice(markerIndex + marker.length);
  return path ? decodeURIComponent(path) : null;
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const evidence = await prisma.checklistEvidence.findUnique({
    where: { id: params.id },
    include: {
      checklist: { select: { campaign: { select: { company_id: true } } } },
    },
  });

  if (!evidence) return NextResponse.json({ error: 'Evidencia nao encontrada' }, { status: 404 });
  if (user.role === 'RH' && evidence.checklist.campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();
  const storagePath = extractStoragePath(evidence.file_url);

  if (storagePath) {
    const { error: storageDeleteError } = await supabase.storage
      .from(CHECKLIST_BUCKET)
      .remove([storagePath]);

    if (storageDeleteError) {
      console.error('Storage delete error:', storageDeleteError);
    }
  }

  await prisma.checklistEvidence.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
