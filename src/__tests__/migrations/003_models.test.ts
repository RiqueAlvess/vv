import fs from 'fs';
import path from 'path';

const MIGRATION_FILE = path.join(
  __dirname,
  '../../../supabase/migrations/003_new_models.sql'
);

const EXPECTED_TABLES = [
  'core.jobs',
  'core.company_feedback_channels',
  'core.anonymous_feedbacks',
  'core.articles',
  'survey.checklist_progress',
  'survey.checklist_evidences',
  'analytics.campaign_metrics',
  'analytics.dim_sectors',
];

describe('Migration 003: new models', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
  });

  it('migration file exists', () => {
    expect(fs.existsSync(MIGRATION_FILE)).toBe(true);
  });

  it.each(EXPECTED_TABLES)('contains CREATE TABLE for %s', (tableName) => {
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
  });

  it('all CREATE TABLE statements use IF NOT EXISTS', () => {
    const createTableLines = sql
      .split('\n')
      .filter((line) => line.trim().toUpperCase().startsWith('CREATE TABLE'));
    expect(createTableLines.length).toBeGreaterThanOrEqual(8);
    for (const line of createTableLines) {
      expect(line.toUpperCase()).toContain('IF NOT EXISTS');
    }
  });

  it('foreign keys reference parent tables correctly', () => {
    expect(sql).toContain('REFERENCES core.companies(id)');
    expect(sql).toContain('REFERENCES core.company_feedback_channels(id)');
    expect(sql).toContain('REFERENCES core.users(id)');
    expect(sql).toContain('REFERENCES survey.campaigns(id)');
    expect(sql).toContain('REFERENCES survey.checklist_progress(id)');
  });
});
