import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { CHECKLIST_STAGES, TOTAL_ITEMS } from '@/lib/checklist-items';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADM' && user.role !== 'RH') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { company: { select: { name: true, cnpj: true } } },
  });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
  if (user.role === 'RH' && campaign.company_id !== user.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const progress = await prisma.checklistProgress.findUnique({
    where: { campaign_id: id },
    include: {
      evidences: {
        select: { id: true, item_id: true, file_name: true, file_url: true, file_type: true },
        orderBy: { uploaded_at: 'asc' },
      },
    },
  });

  const checkedItems = new Set<string>((progress?.checked_items as string[]) ?? []);
  const evidences = progress?.evidences ?? [];

  const completedCount = checkedItems.size;
  const progressPct = TOTAL_ITEMS > 0 ? Math.round((completedCount / TOTAL_ITEMS) * 100) : 0;

  const evidencesByItem: Record<string, typeof evidences> = {};
  for (const ev of evidences) {
    if (!evidencesByItem[ev.item_id]) evidencesByItem[ev.item_id] = [];
    evidencesByItem[ev.item_id].push(ev);
  }

  const stagesHtml = CHECKLIST_STAGES.map(stage => {
    const stageChecked = stage.items.filter(i => checkedItems.has(i.id)).length;
    const stageTotal = stage.items.length;
    const stagePct = Math.round((stageChecked / stageTotal) * 100);

    const itemsHtml = stage.items.map(item => {
      const checked = checkedItems.has(item.id);
      const itemEvidences = evidencesByItem[item.id] ?? [];

      const evidencesHtml = itemEvidences.length > 0
        ? `<div class="evidences">
            <span class="ev-label">Evidências:</span>
            ${itemEvidences.map((ev, idx) => `
              <a href="${ev.file_url}" target="_blank" class="ev-link">
                [${idx + 1}] ${ev.file_name}
              </a>
            `).join('')}
          </div>`
        : '';

      return `
        <div class="item ${checked ? 'item-done' : 'item-pending'}">
          <span class="checkbox">${checked ? '✓' : '○'}</span>
          <div class="item-body">
            <span class="item-text ${checked ? 'done-text' : ''}">${item.text}</span>
            ${evidencesHtml}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="stage">
        <div class="stage-header">
          <span class="stage-title">${stage.title}</span>
          <span class="stage-progress ${stagePct === 100 ? 'done' : ''}">${stageChecked}/${stageTotal}</span>
        </div>
        ${itemsHtml}
      </div>`;
  }).join('');

  const now = new Date().toLocaleString('pt-BR');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Checklist NR-1 — ${campaign.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; background: white; }

  .header { background: #1e3a5f; color: white; padding: 20px 32px; margin-bottom: 20px; }
  .header h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .header p { font-size: 10px; opacity: 0.85; margin-top: 2px; }

  .summary { padding: 0 32px; margin-bottom: 18px; }
  .summary-bar { display: flex; align-items: center; gap: 12px; }
  .progress-track { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 4px; background: ${progressPct >= 80 ? '#22c55e' : progressPct >= 50 ? '#eab308' : '#ef4444'}; width: ${progressPct}%; }
  .progress-label { font-size: 13px; font-weight: 700; color: ${progressPct >= 80 ? '#16a34a' : progressPct >= 50 ? '#ca8a04' : '#dc2626'}; white-space: nowrap; }

  .stage { padding: 0 32px; margin-bottom: 16px; }
  .stage-header { display: flex; justify-content: space-between; align-items: center; background: #1e3a5f; color: white; padding: 6px 12px; border-radius: 4px 4px 0 0; font-size: 11px; font-weight: 700; }
  .stage-progress { font-size: 10px; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 10px; }
  .stage-progress.done { background: #22c55e; }

  .item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 12px; border-bottom: 1px solid #f1f5f9; }
  .item:last-child { border-bottom: none; border-radius: 0 0 4px 4px; }
  .item-done { background: #f0fdf4; }
  .item-pending { background: white; }
  .checkbox { font-size: 12px; font-weight: 700; width: 16px; flex-shrink: 0; margin-top: 1px; color: #22c55e; }
  .item-pending .checkbox { color: #94a3b8; }
  .item-body { flex: 1; }
  .item-text { display: block; line-height: 1.4; }
  .done-text { color: #64748b; }

  .evidences { margin-top: 4px; font-size: 9px; }
  .ev-label { color: #64748b; font-weight: 600; margin-right: 4px; }
  .ev-link { color: #2563eb; text-decoration: none; margin-right: 10px; }
  .ev-link:hover { text-decoration: underline; }

  .footer { position: fixed; bottom: 16px; left: 32px; right: 32px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stage { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>Checklist de Conformidade NR-1 — Riscos Psicossociais</h1>
  <p><strong>${campaign.company.name}</strong> — CNPJ: ${campaign.company.cnpj}</p>
  <p>Campanha: ${campaign.name} &nbsp;|&nbsp; Gerado em: ${now}</p>
  <p>Progresso: ${completedCount} de ${TOTAL_ITEMS} itens concluídos (${progressPct}%)</p>
</div>

<div class="summary">
  <div class="summary-bar">
    <div class="progress-track"><div class="progress-fill"></div></div>
    <span class="progress-label">${progressPct}%</span>
  </div>
</div>

${stagesHtml}

<div class="footer">
  <span>Vivamente360 — Checklist NR-1 | Confidencial</span>
  <span>${campaign.company.name} — ${campaign.name} — ${now}</span>
</div>

</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="Checklist_NR1_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html"`,
    },
  });
}
