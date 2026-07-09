/**
 * PGR HTML report privacy behavior:
 * - When NO sector reaches SECTOR_PRIVACY_MIN respondents, the report collapses
 *   into a single company-wide summary (no unit/sector/GHE breakdown).
 * - When at least one sector reaches the minimum, the GHE breakdown renders and
 *   only below-threshold sectors show the company aggregate with a message.
 */
import { buildCampaignPgrHtmlArtifact } from '@/services/report-export.service';
import { SECTOR_AGGREGATED_MESSAGE, COMPANY_AGGREGATED_MESSAGE } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findUnique: jest.fn() },
    surveyResponse: { findMany: jest.fn() },
    campaignPosition: { findMany: jest.fn() },
    campaignUnit: { findMany: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  campaign: { findUnique: jest.Mock };
  surveyResponse: { findMany: jest.Mock };
  campaignPosition: { findMany: jest.Mock };
  campaignUnit: { findMany: jest.Mock };
};

const campaign = {
  id: 'camp-1',
  name: 'Campanha Teste',
  status: 'closed',
  start_date: new Date('2026-01-01'),
  end_date: new Date('2026-02-01'),
  company: { name: 'ACME Ltda', cnpj: '00.000.000/0001-00' },
};

function makeAnswers(): Record<string, number> {
  const answers: Record<string, number> = {};
  for (let q = 1; q <= 35; q++) answers[`q${q}`] = 2;
  return answers;
}

function makeResponses(sectorCounts: Record<string, number>) {
  const rows: Array<{ responses: Record<string, number>; sector_id: string; position_id: null }> = [];
  for (const [sectorId, count] of Object.entries(sectorCounts)) {
    for (let i = 0; i < count; i++) {
      rows.push({ responses: makeAnswers(), sector_id: sectorId, position_id: null });
    }
  }
  return rows;
}

function setup(sectorCounts: Record<string, number>) {
  mockedPrisma.campaign.findUnique.mockResolvedValue(campaign);
  mockedPrisma.surveyResponse.findMany.mockResolvedValue(makeResponses(sectorCounts));
  mockedPrisma.campaignPosition.findMany.mockResolvedValue([]);
  mockedPrisma.campaignUnit.findMany.mockResolvedValue([
    {
      id: 'unit-1',
      name: 'Matriz',
      sectors: Object.keys(sectorCounts).map((id, i) => ({ id, name: `Setor ${i + 1}` })),
    },
  ]);
}

async function renderHtml(): Promise<string> {
  const artifact = await buildCampaignPgrHtmlArtifact('camp-1');
  return Buffer.from(artifact.base64, 'base64').toString('utf-8');
}

beforeEach(() => jest.clearAllMocks());

describe('buildCampaignPgrHtmlArtifact privacy modes', () => {
  it('collapses to a single company summary when no sector reaches the minimum', async () => {
    setup({ 's1': 3, 's2': 4 });
    const html = await renderHtml();

    expect(html).toContain('Resultado Geral da Empresa');
    expect(html).toContain(COMPANY_AGGREGATED_MESSAGE);
    expect(html).toContain('IGRP');
    // No per-unit/per-sector breakdown at all
    expect(html).not.toContain('UNIDADE:');
    expect(html).not.toContain('GHE / Setor:');
    expect(html).not.toContain(SECTOR_AGGREGATED_MESSAGE);
    // Campaign-wide dimension summary still present
    expect(html).toContain('Resumo da Campanha — Score por Dimensão');
  });

  it('keeps the GHE breakdown and substitutes only small sectors when at least one sector reaches the minimum', async () => {
    setup({ 's1': 6, 's2': 3 });
    const html = await renderHtml();

    expect(html).toContain('Análise por GHE (Grupo Homogêneo de Exposição) / Setor');
    expect(html).toContain('UNIDADE: MATRIZ');
    expect(html).toContain('GHE / Setor: Setor 1');
    expect(html).toContain('GHE / Setor: Setor 2');
    // Only the small sector carries the aggregate message; no company-only collapse
    expect(html).toContain(SECTOR_AGGREGATED_MESSAGE);
    expect(html).not.toContain(COMPANY_AGGREGATED_MESSAGE);
    expect(html).not.toContain('Resultado Geral da Empresa');
  });
});
