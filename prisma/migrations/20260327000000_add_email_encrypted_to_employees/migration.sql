-- AlterTable: add nullable email_encrypted column to campaign_employees
-- This column stores AES-256-GCM encrypted email addresses.
-- It is populated during CSV import and permanently deleted after
-- the invitation email is successfully dispatched (privacy by design).
ALTER TABLE "survey"."campaign_employees" ADD COLUMN "email_encrypted" TEXT;
