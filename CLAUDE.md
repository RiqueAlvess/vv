# CLAUDE.md — Asta: Plataforma de Riscos Psicossociais NR-1

## Versão Atual: 1.1.0

## Project Overview
- **What it is**: Multi-tenant SaaS for companies to run anonymous psychosocial risk assessments (HSE-IT questionnaire, 35 questions, 7 dimensions) for NR-1 compliance
- **Core architectural invariant**: Blind-Drop anonymity — SurveyResponse has NO FK to any identifying record. This is enforced by design and must never be broken.
- **Stack**: Next.js 14 App Router, TypeScript, Prisma ORM, Supabase (PostgreSQL + multi-schema: core/survey/analytics), job queue via `core.jobs` DB table + worker, Resend (email), @react-pdf/renderer (PDF export), ExcelJS (XLSX export)

## Directory Map

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── campaigns/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── companies/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── users/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── me/route.ts
│   │   │   ├── refresh/route.ts
│   │   │   └── switch-company/route.ts
│   │   ├── campaigns/
│   │   │   ├── route.ts
│   │   │   ├── igrp-timeline/route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── activate/route.ts
│   │   │       ├── close/route.ts
│   │   │       ├── action-plan/route.ts
│   │   │       ├── action-plan/pdf/route.ts
│   │   │       ├── checklist/pdf/route.ts
│   │   │       ├── dashboard/route.ts
│   │   │       ├── dashboard/export/route.ts   ← XLSX export (ADM + MEDICO)
│   │   │       ├── employees/route.ts
│   │   │       ├── hse-agent/route.ts
│   │   │       ├── invitations/route.ts
│   │   │       ├── metrics/route.ts
│   │   │       ├── qrcode/route.ts
│   │   │       ├── report/route.ts             ← GHE/setor-based PGR data
│   │   │       ├── report/pdf/route.ts
│   │   │       ├── report/xlsx/route.ts        ← XLSX GHE report (RH + MEDICO)
│   │   │       ├── units/route.ts
│   │   │       └── upload-csv/route.ts
│   │   ├── action-plans/route.ts
│   │   ├── companies/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── checklist/route.ts
│   │   ├── feedback/channel/route.ts
│   │   ├── survey/[token]/route.ts
│   │   └── users/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── survey/
│   │   ├── layout.tsx
│   │   └── [token]/page.tsx
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── companies/companies-data-table.tsx
│   ├── dashboard/
│   │   ├── campaign-dashboard.tsx
│   │   ├── charts/
│   │   │   ├── age-risk-chart.tsx
│   │   │   ├── gender-risk-chart.tsx
│   │   │   ├── ghe-table.tsx               ← GHE/setor table (main detailed table)
│   │   │   ├── heatmap-chart.tsx
│   │   │   ├── igrp-bar-chart.tsx
│   │   │   ├── kpi-row.tsx                 ← showRespondents prop: ADM+MEDICO see counts
│   │   │   ├── position-table.tsx          ← legacy, not used in main dashboard
│   │   │   ├── radar-score-chart.tsx
│   │   │   ├── stacked-dimension-chart.tsx
│   │   │   ├── stacked-question-chart.tsx
│   │   │   └── workers-risk-donut.tsx
│   │   ├── delta-strip.tsx
│   │   └── locked-state.tsx
│   ├── layout/
│   │   ├── app-sidebar.tsx
│   │   └── header.tsx
│   ├── modals/
│   │   ├── confirm-modal.tsx
│   │   └── csv-upload-modal.tsx
│   └── ui/               ← shadcn/ui primitives (do not hand-edit)
├── hooks/
│   ├── use-api.ts
│   ├── use-auth.ts
│   ├── use-campaign-dashboard.ts
│   ├── use-companies.ts
│   ├── use-mobile.ts
│   └── use-notifications.ts
├── lib/
│   ├── auth.ts           ← JWT sign/verify, getAuthUser()
│   ├── constants.ts      ← HSE-IT question mapping, dimension config
│   ├── crypto.ts         ← HMAC-SHA256 CPF hashing
│   ├── dashboard-cache.ts ← Cache helpers, DASHBOARD_CACHE_VERSION (currently 5)
│   ├── email.ts          ← Resend dispatch helpers
│   ├── encryption.ts     ← AES-256-GCM encrypt/decrypt
│   ├── jobs.ts           ← Job enqueue helper (writes to core.jobs table)
│   ├── pdf/pgr-report.tsx ← @react-pdf/renderer PGR document
│   ├── prisma.ts         ← Prisma client singleton
│   ├── query-client.ts   ← TanStack Query client config
│   ├── rate-limit.ts     ← In-memory rate limiters
│   ├── report-helpers.ts ← computeDimensions() helper for reports
│   ├── scoring.ts        ← HSE-IT scoring engine
│   ├── session.ts        ← requireSession() server action helper
│   ├── supabase/
│   │   ├── client.ts     ← Browser Supabase client
│   │   └── server.ts     ← Server Supabase client
│   ├── utils.ts
│   └── validations.ts    ← Zod schemas (includes date transform fix)
├── services/
│   ├── metrics.service.ts    ← Computes and stores CampaignMetrics (called by job worker)
│   ├── report-export.service.ts ← XLSX and PDF generation
│   └── score.service.ts      ← Dimension/NR/IGRP computation
├── types/
│   ├── css.d.ts
│   └── index.ts          ← Shared TypeScript types
└── workers/
    └── index.ts          ← Worker process (run separately)

prisma/
└── schema.prisma         ← Multi-schema Prisma schema

supabase/migrations/
├── 001_initial_schema.sql
└── 002_fix_questions_seed.sql
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string. Must include `?search_path=core,survey,analytics` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `JWT_SECRET` | HS256 secret for access tokens (15m expiry). Must be >= 32 chars. |
| `JWT_REFRESH_SECRET` | HS256 secret for refresh tokens (7d expiry). Must differ from `JWT_SECRET`. |
| `RESEND_API_KEY` | Resend API key for email dispatch |
| `EMAIL_FROM` | Sender address e.g. `"Asta <noreply@domain.com.br>"` |
| `NEXT_PUBLIC_APP_URL` | Base URL for magic link generation e.g. `"https://app.domain.com.br"` |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) for AES-256-GCM. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REDIS_URL` | Redis connection (legacy BullMQ setup, may not be in active use) |

## Roles and Permissions

| Role | Scope | Can Do |
|---|---|---|
| `ADM` | System-wide | All companies, users, campaigns. Creates companies, creates users of any role. Full dashboard including respondent counts and XLSX export. |
| `RH` | Company-scoped | Manages campaigns for their company. Uploads CSV, manages QR codes, dispatches invitations. Sees dashboard but **NOT** raw respondent counts (only % rate). Exports PGR PDF. GHE table without N Respostas column. |
| `MEDICO` | Company-scoped | Same view as RH but **CAN** see respondent counts and export XLSX spreadsheet. Read-only: cannot create campaigns, upload CSV, or activate campaigns. |

## Privacy Rules (enforced since v1.1.0)

- **Sector blind (GHE)**: Sectors with fewer than **2 respondents** are never shown in the GHE table. Applies to both cached and live-computed dashboards. Constant: `SECTOR_PRIVACY_MIN = 2` in both `dashboard/route.ts` and `metrics.service.ts`.
- **RH respondent count**: RH role sees only a "Taxa de Adesão" percentage card — never the raw respondent count. ADM and MEDICO see the "Respondentes" card with absolute numbers.
- **Sector filter gate**: If a user drills into a specific sector with < 2 responses, the dashboard shows a "Dados protegidos" screen.

## GHE (Grupos Homogêneos de Exposição)

Since v1.1.0, the dashboard's detailed analysis is organized by **sector** (GHE), not by job title/cargo.

- **`GheTable` component** (`src/components/dashboard/charts/ghe-table.tsx`): One row per sector with ≥5 responses. Shows N Respostas only for ADM and MEDICO.
- **PGR Report** (`POST /api/campaigns/[id]/report`): Returns `{ units: [{ name, sectors: [{ name, unit, n_responses, dimensions }] }] }` — sector-based hierarchy. Sectors with < 5 responses are excluded.
- **Dashboard payload key**: `sector_table` (was `position_table` before v1.1.0)
- **Cache key**: `top_critical_groups` in `CampaignMetrics` stores the sector array (same DB field, different shape)

## Data Models — Critical Notes

- `SurveyResponse` = **NO FK** to invitation, employee, or any identifying record. Only: `campaign_id`, `session_uuid` (ephemeral), demographics (optional), responses (JSON).
- `CampaignEmployee` = roster table; records CPF hash for deduplication but has NO link to `SurveyResponse`.
- `CampaignMetrics.top_critical_groups` = stores the GHE/sector table for dashboard cache (v5 format = sector-based with `avg_hse_score` and `sector` string fields).

## Dashboard Cache

- **`DASHBOARD_CACHE_VERSION = 5`** (bumped in v1.1.0 to invalidate pre-GHE caches)
- Stored in `analytics.CampaignMetrics` table
- Closed campaigns: always served from cache (result set is immutable)
- Active campaigns: cache valid for 5 minutes
- `hasCompatibleDashboardShape()` in `dashboard-cache.ts` validates the shape and rejects stale caches
- Validators check: `dimension_scores` (array), `heatmap_data` (array), `top_critical_groups` (array with `avg_hse_score: number` and `sector: string`), `scores_by_gender` (array), `scores_by_age` (array), `risk_distribution` (object with `payload_version` matching `DASHBOARD_CACHE_VERSION`)

## HSE-IT Scoring Logic

7 dimensions defined in `src/lib/constants.ts`:

| Dimension | Type | Questions |
|---|---|---|
| `demandas` | NEGATIVE | q3, q6, q9, q12, q16, q18, q20, q22 |
| `controle` | POSITIVE | q2, q10, q15, q19, q25, q30 |
| `apoio_chefia` | POSITIVE | q8, q23, q29, q33, q35 |
| `apoio_colegas` | POSITIVE | q7, q24, q27, q31 |
| `relacionamentos` | NEGATIVE | q5, q14, q21, q34 |
| `cargo` | POSITIVE | q1, q4, q11, q13, q17 |
| `comunicacao_mudancas` | POSITIVE | q26, q28, q32 |

**Risk thresholds — NEGATIVE dimensions** (high score = high risk):
- `crítico`: mean ≥ 3.1
- `importante`: mean ≥ 2.1
- `moderado`: mean ≥ 1.1
- `aceitável`: mean < 1.1

**Risk thresholds — POSITIVE dimensions** (inverted — low score = high risk):
- `crítico`: mean ≤ 1.0
- `importante`: mean ≤ 2.0
- `moderado`: mean ≤ 3.0
- `aceitável`: mean > 3.0

**NR** = probability × severity (severity: `crítico` = 4, others = 2)
**IGRP** = mean of all 7 dimension NR values

## Job System

Jobs are stored in `core.jobs` table (NOT Redis/BullMQ).

| Job Type | Trigger | What It Does |
|---|---|---|
| `calculate_campaign_metrics` | Dashboard request with no cache for closed campaign | Computes and stores `CampaignMetrics` |
| `generate_campaign_pgr_html` | PDF export request (async mode) | Generates PGR HTML/PDF artifact |
| `generate_dashboard_xlsx` | XLSX export request (async mode) | Generates dashboard XLSX artifact |

Worker: `src/workers/index.ts` — run separately with `npm run worker`

## API Patterns

- All routes: `getAuthUser(request)` → returns `JWTPayload | null`
- Role guard: `if (user.role !== 'ADM' && user.role !== 'RH' && user.role !== 'MEDICO')`
- Company scope: `if (user.role !== 'ADM' && campaign.company_id !== user.company_id)`
- Zod validates all inputs; never trust raw `req.body`
- Rate limiting: `loginLimiter` (3/min), `apiLimiter` (60/min) — in-memory (`src/lib/rate-limit.ts`)

## Common Hurdles

### HURDLE 1: DateTime format
**Problem**: Prisma DateTime fields reject date-only strings (`"2026-03-27"`)
**Root cause**: HTML date inputs return `YYYY-MM-DD` without time component
**Solution**: `campaignSchema` in `validations.ts` transforms date-only to ISO. `start_date` → `T00:00:00.000Z`, `end_date` → `T23:59:59.000Z`

### HURDLE 2: Multi-schema Prisma
**Problem**: Tables in different schemas (core, survey, analytics) need explicit `@@schema()` annotation
**Solution**: Every model has `@@schema("schema_name")`. `DATABASE_URL` must include `?search_path=core,survey,analytics`

### HURDLE 3: Dashboard cache version
**Problem**: Old cached metrics have position-based structure; new UI expects sector/GHE structure
**Solution**: Bump `DASHBOARD_CACHE_VERSION` in `dashboard-cache.ts`. `hasCompatibleDashboardShape()` rejects stale caches. Currently at version 5.

### HURDLE 4: Campaign status is irreversible
**Problem**: `'closed'` campaigns cannot be reopened
**Solution**: No API route exists for `closed→active`. Guard in all status-transition endpoints.

### HURDLE 5: Dashboard only for closed campaigns
**Problem**: Dashboard returns 202 (computing) or locked state for non-closed campaigns
**Solution**: `CampaignDashboard` checks `campaignStatus` before fetching. Shows locked state otherwise.

### HURDLE 6: MEDICO role gaps
**Problem**: New `MEDICO` role needs to be included in all role-check guards that previously only allowed `ADM | RH`
**Solution**: Search for `user.role !== 'RH'` patterns. The pattern to use: `user.role !== 'ADM' && user.role !== 'RH' && user.role !== 'MEDICO'`. The sidebar `navItems` and `types/index.ts` already have MEDICO defined.
