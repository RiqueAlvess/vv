import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enqueueJob } from '@/lib/jobs';
import { log } from '@/lib/logger';

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

  const now = new Date();

  const expiredCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'active',
      end_date: { lt: now },
    },
    select: { id: true, name: true, company_id: true },
  });

  if (expiredCampaigns.length === 0) {
    return NextResponse.json({ closed: 0, message: 'No expired campaigns found' });
  }

  const results: { id: string; name: string; success: boolean; error?: string }[] = [];

  for (const campaign of expiredCampaigns) {
    try {
      await prisma.$transaction([
        prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'closed', updated_at: new Date() },
        }),
        // Drop all remaining cpf_hash for anonymity compliance
        prisma.campaignEmployee.updateMany({
          where: { campaign_id: campaign.id, cpf_hash: { not: null } },
          data: { cpf_hash: null },
        }),
      ]);

      log('AUDIT', {
        action: 'campaign.auto_close',
        message: `Campanha encerrada automaticamente por prazo expirado: ${campaign.name}`,
        user_id: 'system',
        company_id: campaign.company_id,
        target_id: campaign.id,
        target_type: 'campaign',
      });

      try {
        const jobId = await enqueueJob('calculate_campaign_metrics', { campaign_id: campaign.id });
        console.log(`[AutoClose] Metrics job enqueued for campaign ${campaign.id}: ${jobId}`);
      } catch (metricsErr) {
        console.error(`[AutoClose] Metrics enqueue failed for campaign ${campaign.id} (non-fatal):`, metricsErr);
      }

      results.push({ id: campaign.id, name: campaign.name, success: true });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[AutoClose] Failed to close campaign ${campaign.id}:`, errorMsg);
      results.push({ id: campaign.id, name: campaign.name, success: false, error: errorMsg });
    }
  }

  const closed = results.filter((r) => r.success).length;
  console.log(`[AutoClose] Closed ${closed}/${expiredCampaigns.length} expired campaigns`);

  return NextResponse.json({ closed, total: expiredCampaigns.length, results });
}
