import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

  const campaignsToOpen = await prisma.campaign.findMany({
    where: {
      status: 'draft',
      start_date: { lte: now },
    },
    select: { id: true, name: true, company_id: true },
  });

  if (campaignsToOpen.length === 0) {
    return NextResponse.json({ opened: 0, message: 'No campaigns ready to open' });
  }

  const results: { id: string; name: string; success: boolean; error?: string }[] = [];

  for (const campaign of campaignsToOpen) {
    try {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'active', updated_at: new Date() },
      });

      log('AUDIT', {
        action: 'campaign.auto_open',
        message: `Campanha iniciada automaticamente: ${campaign.name}`,
        user_id: 'system',
        company_id: campaign.company_id,
        target_id: campaign.id,
        target_type: 'campaign',
      });

      results.push({ id: campaign.id, name: campaign.name, success: true });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[AutoOpen] Failed to open campaign ${campaign.id}:`, errorMsg);
      results.push({ id: campaign.id, name: campaign.name, success: false, error: errorMsg });
    }
  }

  const opened = results.filter((r) => r.success).length;
  console.log(`[AutoOpen] Opened ${opened}/${campaignsToOpen.length} campaigns`);

  return NextResponse.json({ opened, total: campaignsToOpen.length, results });
}
