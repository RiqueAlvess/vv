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

  const artifact = (payload.artifact ?? null) as null | {
    filename?: string;
    contentType?: string;
  };

  return NextResponse.json({
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    error: job.error,
    has_artifact: Boolean(artifact),
    artifact: artifact
      ? {
          filename: artifact.filename ?? null,
          content_type: artifact.contentType ?? null,
        }
      : null,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  });
}
