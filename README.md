# Asta — Plataforma de Riscos Psicossociais NR-1

Multi-tenant SaaS for companies to run anonymous psychosocial risk assessments (HSE-IT questionnaire) for NR-1 compliance.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (via Supabase)
- Redis (for BullMQ)

### Setup

1. Copy `.env.example` to `.env` and fill in all required variables.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Apply database migrations:
   ```bash
   npx supabase db push
   ```
4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

## Seed default admin

After applying migrations, run:

```bash
npm run seed:admin
```

This creates:
- Company: **Empresa Admin** (CNPJ: 00.000.000/0000-00)


## Development

```bash
npm run dev       # Next.js dev server
npm run worker    # BullMQ worker process (run separately)
npm run build     # Production build
```

## Production Setup (Hostinger VPS)

### First time — full init
```bash
git clone <your-repo-url> .
cp .env.local.example .env.local
# Edit .env.local with production values
npm run init:server
```

This single command:
1. Validates Node.js and environment
2. Installs all dependencies
3. Generates Prisma client
4. Applies database migrations
5. Creates default admin user
6. Builds the Next.js app
7. Starts app + worker via PM2
8. Configures PM2 to survive reboots

### Subsequent deploys
```bash
npm run deploy:update
```

### Full reset
```bash
npm run reset:server
```

