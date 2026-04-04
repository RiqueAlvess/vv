import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getJobById } from '@/lib/jobs';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const job = await getJobById(id);
  if (!job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });

  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const requester = String(payload.requester_user_id ?? '');
  if (requester && requester !== user.user_id && user.role !== 'ADM') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (job.status !== 'done') {
    return NextResponse.json({ error: 'Job ainda não concluído' }, { status: 409 });
  }

  const artifact = (payload.artifact ?? null) as null | {
    filename?: string;
    contentType?: string;
    base64?: string;
  };

  if (!artifact?.base64) {
    return NextResponse.json({ error: 'Job sem artefato para download' }, { status: 404 });
  }

  const buffer = Buffer.from(artifact.base64, 'base64');
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': artifact.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${artifact.filename ?? `job-${id}.bin`}"`,
    },
  });
}
