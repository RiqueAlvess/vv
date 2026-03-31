import fs from 'fs';
import path from 'path';

const MIGRATION_FILE = path.join(
  __dirname,
  '../../../supabase/migrations/010_performance_indexes.sql'
);

const EXPECTED_INDEXES = [
  'idx_survey_responses_campaign_id',
  'idx_survey_invitations_campaign_id',
  'idx_survey_invitations_status',
  'idx_fact_responses_campaign_id',
  'idx_jobs_status_run_after',
];

describe('Migration 010: performance indexes', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
  });

  it('migration file exists', () => {
    expect(fs.existsSync(MIGRATION_FILE)).toBe(true);
  });

  it.each(EXPECTED_INDEXES)('contains index %s', (indexName) => {
    expect(sql).toContain(indexName);
  });

  it('all indexes use IF NOT EXISTS', () => {
    const createIndexLines = sql
      .split('\n')
      .filter((line) => line.trim().toUpperCase().startsWith('CREATE INDEX'));
    expect(createIndexLines.length).toBeGreaterThan(0);
    for (const line of createIndexLines) {
      expect(line.toUpperCase()).toContain('IF NOT EXISTS');
    }
  });

  it('covers all three schemas', () => {
    expect(sql).toContain('survey.survey_responses');
    expect(sql).toContain('survey.survey_invitations');
    expect(sql).toContain('analytics.fact_responses');
    expect(sql).toContain('core.jobs');
  });

  it('jobs index is a partial index for pending/failed only', () => {
    expect(sql).toMatch(/idx_jobs_status_run_after[\s\S]*?WHERE status IN \('pending', 'failed'\)/);
  });
});
