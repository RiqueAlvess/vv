# CLAUDE.md — Asta: Plataforma de Riscos Psicossociais NR-1

## Project Overview
- **What it is**: Multi-tenant SaaS for companies to run anonymous psychosocial risk assessments (HSE-IT questionnaire, 35 questions, 7 dimensions) for NR-1 compliance
- **Core architectural invariant**: Blind-Drop anonymity — SurveyResponse and SurveyInvitation share ZERO identifying columns. This is enforced by design and must never be broken.
- **Stack**: Next.js 14 App Router, TypeScript, Prisma ORM, Supabase (PostgreSQL + multi-schema: core/survey/analytics), BullMQ + Redis (delayed jobs), Resend (email), @react-pdf/renderer (PDF export)

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
│   │   │   └── refresh/route.ts
│   │   ├── campaigns/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── activate/route.ts
│   │   │       ├── close/route.ts
│   │   │       ├── dashboard/route.ts
│   │   │       ├── employees/route.ts
│   │   │       ├── invitations/route.ts
│   │   │       ├── metrics/route.ts
│   │   │       ├── report/route.ts
│   │   │       ├── report/pdf/route.ts
│   │   │       ├── send-invitations/route.ts
│   │   │       └── upload-csv/route.ts
│   │   ├── companies/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
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
│   │   ├── critical-sectors-table.tsx
│   │   ├── dimension-radar.tsx
│   │   ├── heatmap-chart.tsx
│   │   ├── kpi-cards.tsx
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
│   ├── crypto.ts         ← HMAC-SHA256 email hashing
│   ├── email.ts          ← Resend dispatch helpers
│   ├── encryption.ts     ← AES-256-GCM encrypt/decrypt
│   ├── pdf/pgr-report.tsx ← @react-pdf/renderer PGR document
│   ├── prisma.ts         ← Prisma client singleton
│   ├── query-client.ts   ← TanStack Query client config
│   ├── queue.ts          ← BullMQ queue/connection setup
│   ├── rate-limit.ts     ← In-memory rate limiters
│   ├── scoring.ts        ← HSE-IT scoring engine
│   ├── session.ts        ← requireSession() server action helper
│   ├── supabase/
│   │   ├── client.ts     ← Browser Supabase client
│   │   └── server.ts     ← Server Supabase client
│   ├── utils.ts
│   └── validations.ts    ← Zod schemas (includes date transform fix)
├── services/
│   ├── anonymity.service.ts  ← Blind-Drop enforcement helpers
│   ├── dashboard.service.ts  ← Aggregation queries for dashboard API
│   └── score.service.ts      ← Dimension/NR/IGRP computation
├── types/
│   ├── css.d.ts
│   └── index.ts          ← Shared TypeScript types
└── workers/
    └── index.ts          ← BullMQ worker process (run separately)

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
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) for AES-256-GCM email encryption. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REDIS_URL` | Redis connection for BullMQ e.g. `"redis://localhost:6379"` |

## Roles and Permissions

| Role | Scope | Can Do |
|---|---|---|
| `ADM` | System-wide | All companies, users, campaigns. Only role that can create companies. |
| `RH` | Company-scoped | Manages campaigns for their company. Uploads CSV, dispatches invitations. Sees aggregated data only — never individual responses or real emails. |
| `LIDERANCA` | Sector-scoped (read-only) | Dashboard data for their assigned sector only. No job titles in their view. |

## Data Models — Critical Notes

- `CampaignEmployee.email_hash` = HMAC-SHA256(email, campaign_salt). Deterministic per campaign. RH sees only hash.
- `CampaignEmployee.email_encrypted` = AES-256-GCM encrypted email. Exists ONLY until first send. Deleted after Resend confirms delivery.
- `SurveyInvitation.token_public` = UUID magic link token. **Set to NULL after use** (not just flagged — nullified).
- `SurveyResponse` = **NO FK** to invitation, employee, or any identifying record. Only: `campaign_id`, `session_uuid` (ephemeral), demographics (optional), responses (JSON).

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

**NR** = probability × severity (severity fixed at 2)
**IGRP** = mean of all 7 dimension NR values

## Job Queue (BullMQ)

- **Queue name**: `status-updates`
- **Job type**: `update-status` — payload `{ invitationId: string }`
- **Purpose**: Delayed (1–12h random) flip of `SurveyInvitation.status` to `'completed'`
- **Worker**: `src/workers/index.ts` — run separately with `npm run worker`
- **Deduplication**: `jobId = status-{invitationId}`

## Common Hurdles

### HURDLE 1: DateTime format
**Problem**: Prisma DateTime fields reject date-only strings (`"2026-03-27"`)
**Root cause**: HTML date inputs return `YYYY-MM-DD` without time component
**Solution**: `campaignSchema` in `validations.ts` transforms date-only to ISO. `start_date` → `T00:00:00.000Z`, `end_date` → `T23:59:59.000Z`

### HURDLE 2: Multi-schema Prisma
**Problem**: Tables in different schemas (core, survey, analytics) need explicit `@@schema()` annotation
**Root cause**: Supabase uses schema separation; Prisma needs `previewFeatures = ["multiSchema"]` (or stable in Prisma 5.x)
**Solution**: Every model has `@@schema("schema_name")`. `DATABASE_URL` must include `?search_path=core,survey,analytics`

### HURDLE 3: Blind-Drop — no email after send
**Problem**: Can't re-send to employees after `email_encrypted` is deleted
**Root cause**: By design — email is deleted after first send for LGPD compliance
**Solution**: If resend needed, RH must re-upload CSV and create new invitations. Cannot recover deleted encrypted emails.

### HURDLE 4: Token nullification
**Problem**: `SurveyInvitation.token_public` is set to `null` after use, so `findUnique` by token returns `null` for used tokens
**Root cause**: Intentional — nullifying the token breaks the lookup chain permanently
**Solution**: When `token_used_internally=true` and `token_public=null`, the invitation is used. Show "already used" on the survey page when GET returns 404 or token_used response.

### HURDLE 5: Campaign status is irreversible
**Problem**: `'closed'` campaigns cannot be reopened
**Root cause**: Business rule + anonymity guarantee (re-opening would allow temporal correlation attacks)
**Solution**: No API route exists for `closed→active`. The UI never shows a "reactivate" button. Guard in all status-transition endpoints.

### HURDLE 6: Dashboard only for closed campaigns
**Problem**: Dashboard API returns 400 for non-closed campaigns
**Root cause**: Releasing partial data during active collection breaks anonymity (temporal correlation)
**Solution**: `CampaignDashboard` component checks `campaignStatus` before calling the data hook (`enabled: false`). `LockedState` component renders instead.

## Design Patterns

- All API routes use `getAuthUser()` → returns `JWTPayload | null` (`src/lib/auth.ts`)
- All Server Actions use `requireSession()` → throws if unauthenticated (`src/lib/session.ts`)
- Zod validates all API inputs. Never use `req.body` directly.
- Result type for Server Actions: `{ success: true; data: T } | { success: false; error: string }`
- Rate limiting: `loginLimiter` (3/min), `apiLimiter` (60/min) — in-memory store, not Redis (`src/lib/rate-limit.ts`)
- TanStack Query for all client-side data fetching with `staleTime` tuned per resource (`src/lib/query-client.ts`)

## Known Gaps (as of last update)

- **Sector-level PGR scores**: all positions show campaign-wide averages (Blind-Drop constraint)
- **LIDERANCA sector filter**: `dashboard_restricted` flag is set but no actual sector filtering implemented on the data
- **Email retry**: no retry mechanism if Resend fails — failed sends are logged and counted but not retried
- **CSV re-upload**: uploading a new CSV to an active/closed campaign is blocked; only works in `draft` status
