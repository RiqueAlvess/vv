import { claimNextJob, completeJob, failJob } from '@/lib/jobs';
import { calculateAndStoreCampaignMetrics } from '@/services/metrics.service';
import { buildCampaignPgrHtmlArtifact, buildDashboardXlsxArtifact } from '@/services/report-export.service';

const IDLE_SLEEP_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOneJob() {
  const job = await claimNextJob();
  if (!job) return false;

  try {
    if (job.type === 'calculate_campaign_metrics') {
      const campaignId = String(job.payload.campaign_id ?? '');
      if (!campaignId) throw new Error('Missing campaign_id');
      await calculateAndStoreCampaignMetrics(campaignId);
      await completeJob(job.id, { ...job.payload, result: 'metrics_updated' });
      return true;
    }

    if (job.type === 'generate_dashboard_xlsx') {
      const campaignId = String(job.payload.campaign_id ?? '');
      if (!campaignId) throw new Error('Missing campaign_id');
      const artifact = await buildDashboardXlsxArtifact(campaignId);
      await completeJob(job.id, {
        ...job.payload,
        artifact,
      });
      return true;
    }

    if (job.type === 'generate_campaign_pgr_html') {
      const campaignId = String(job.payload.campaign_id ?? '');
      if (!campaignId) throw new Error('Missing campaign_id');
      const artifact = await buildCampaignPgrHtmlArtifact(campaignId);
      await completeJob(job.id, {
        ...job.payload,
        artifact,
      });
      return true;
    }

    throw new Error(`Unsupported job type: ${job.type}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown job error';
    console.error('[Worker] Job failed:', job.id, job.type, message);
    await failJob(job.id, message);
    return true;
  }
}

async function main() {
  console.log('[Worker] Started job processor');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const processed = await processOneJob();
    if (!processed) {
      await sleep(IDLE_SLEEP_MS);
    }
  }
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
