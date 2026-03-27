import { NextResponse } from 'next/server';
import { claimNextJob, completeJob, failJob } from '@/lib/jobs';
import { calculateAndStoreCampaignMetrics } from '@/services/metrics.service';
import { sendInvitationEmail } from '@/lib/email';

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  // If no secret configured, allow all calls (development)
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
        const payload = job.payload as {
          to: string;
          campaign_name: string;
          company_name: string;
          token: string;
          expires_at: string;
        };
        const sent = await sendInvitationEmail({
          to: payload.to,
          campaignName: payload.campaign_name,
          companyName: payload.company_name,
          token: payload.token,
          expiresAt: new Date(payload.expires_at),
        });
        if (!sent) throw new Error(`Resend failed for token ${payload.token}`);
        break;
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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { prisma } = await import('@/lib/prisma');
  const counts = await prisma.job.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  return NextResponse.json({
    queue: counts.reduce((acc, row) => ({ ...acc, [row.status]: row._count.id }), {}),
  });
}
