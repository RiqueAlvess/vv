import { NextResponse } from 'next/server';
import { claimNextJob, completeJob, failJob } from '@/lib/jobs';
import { calculateAndStoreCampaignMetrics } from '@/services/metrics.service';
import { buildCampaignPgrHtmlArtifact, buildDashboardXlsxArtifact } from '@/services/report-export.service';

export const dynamic = 'force-dynamic';

function checkAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const authError = checkAuth(request);
  if (authError) return authError;

  const job = await claimNextJob();

  if (!job) {
    return NextResponse.json({ status: 'idle', message: 'No pending jobs' });
  }

  console.log(`[JobProcessor] Processing job ${job.id} type=${job.type}`);

  try {
    switch (job.type) {
      case 'calculate_campaign_metrics': {
        const { campaign_id } = job.payload as { campaign_id: string };
        await calculateAndStoreCampaignMetrics(campaign_id);
        break;
      }

      case 'send_invitation_email': {
        // Email invitations removed — QR code model. Silently skip.
        break;
      }

      case 'generate_campaign_pgr_html': {
        const { campaign_id } = job.payload as { campaign_id: string };
        const artifact = await buildCampaignPgrHtmlArtifact(campaign_id);
        await completeJob(job.id, { ...job.payload, artifact });
        console.log(`[JobProcessor] Job ${job.id} completed`);
        return NextResponse.json({ status: 'processed', job_id: job.id, type: job.type });
      }

      case 'generate_dashboard_xlsx': {
        const { campaign_id } = job.payload as { campaign_id: string };
        const artifact = await buildDashboardXlsxArtifact(campaign_id);
        await completeJob(job.id, { ...job.payload, artifact });
        console.log(`[JobProcessor] Job ${job.id} completed`);
        return NextResponse.json({ status: 'processed', job_id: job.id, type: job.type });
      }

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    await completeJob(job.id);
    console.log(`[JobProcessor] Job ${job.id} completed`);
    return NextResponse.json({ status: 'processed', job_id: job.id, type: job.type });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await failJob(job.id, errorMsg);
    console.error(`[JobProcessor] Job ${job.id} failed:`, errorMsg);
    return NextResponse.json(
      { status: 'failed', job_id: job.id, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const authError = checkAuth(request);
  if (authError) return authError;
  const { prisma } = await import('@/lib/prisma');
  const counts = await prisma.job.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  return NextResponse.json({
    queue: counts.reduce((acc, row) => ({ ...acc, [row.status]: row._count.id }), {}),
  });
}
