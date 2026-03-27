-- ============================================================================
-- Multi-tenant SaaS Psychosocial Risk Analysis System
-- Initial Database Schema
-- ============================================================================

-- ============================================================================
-- SCHEMAS
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS survey;
CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- UTILITY: updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA: core
-- ============================================================================

-- companies
CREATE TABLE core.companies (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  cnpj       varchar(18) UNIQUE NOT NULL,
  cnae       varchar(10),
  active     boolean     DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON core.companies
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- users
CREATE TABLE core.users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES core.companies(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  email         text        UNIQUE NOT NULL,
  password_hash text        NOT NULL,
  role          varchar(20) NOT NULL CHECK (role IN ('ADM','RH','LIDERANCA')),
  sector_id     uuid,
  active        boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON core.users
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- refresh_tokens
CREATE TABLE core.refresh_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  token      text        UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SCHEMA: survey
-- ============================================================================

-- campaigns
CREATE TABLE survey.campaigns (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES core.companies(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  start_date    timestamptz NOT NULL,
  end_date      timestamptz NOT NULL,
  status        varchar(20) DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  campaign_salt text        NOT NULL,
  created_by    uuid        REFERENCES core.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON survey.campaigns
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- campaign_units
CREATE TABLE survey.campaign_units (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid        NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- campaign_sectors
CREATE TABLE survey.campaign_sectors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id    uuid        NOT NULL REFERENCES survey.campaign_units(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- campaign_positions
CREATE TABLE survey.campaign_positions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id  uuid        NOT NULL REFERENCES survey.campaign_sectors(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- campaign_employees
CREATE TABLE survey.campaign_employees (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid        NOT NULL REFERENCES survey.campaign_positions(id) ON DELETE CASCADE,
  email_hash  text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT uq_employee_position_email UNIQUE (position_id, email_hash)
);

-- survey_invitations
CREATE TABLE survey.survey_invitations (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                 uuid        NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  employee_id                 uuid        NOT NULL REFERENCES survey.campaign_employees(id) ON DELETE CASCADE,
  token_public                uuid        UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  token_used                  boolean     DEFAULT false,
  token_used_internally       boolean     DEFAULT false,
  status                      varchar(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','opened','completed')),
  status_update_scheduled_at  timestamptz,
  sent_at                     timestamptz,
  expires_at                  timestamptz,
  created_at                  timestamptz DEFAULT now()
);

-- survey_responses (NO FK to invitations or employees -- anonymity guarantee)
CREATE TABLE survey.survey_responses (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid        NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  session_uuid        uuid        NOT NULL,
  gender              varchar(1)  CHECK (gender IN ('M','F','O','N') OR gender IS NULL),
  age_range           varchar(20),
  consent_accepted    boolean     NOT NULL DEFAULT true,
  consent_accepted_at timestamptz,
  responses           jsonb       NOT NULL,
  created_at          timestamptz DEFAULT now()
);

-- survey_questions
CREATE TABLE survey.survey_questions (
  id              serial      PRIMARY KEY,
  question_number int         UNIQUE NOT NULL,
  dimension       varchar(30) NOT NULL,
  question_text   text        NOT NULL,
  active          boolean     DEFAULT true
);

-- ============================================================================
-- SCHEMA: analytics
-- ============================================================================

-- fact_responses
CREATE TABLE analytics.fact_responses (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid         NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  response_id uuid         NOT NULL REFERENCES survey.survey_responses(id) ON DELETE CASCADE,
  dimension   varchar(30)  NOT NULL,
  score       numeric(4,2) NOT NULL,
  risk_level  varchar(20)  NOT NULL,
  nr_value    numeric(5,2),
  created_at  timestamptz  DEFAULT now()
);

-- dim_sectors
CREATE TABLE analytics.dim_sectors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid        NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  unit_name     text,
  sector_name   text,
  position_name text,
  created_at    timestamptz DEFAULT now()
);

-- campaign_metrics
CREATE TABLE analytics.campaign_metrics (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid         NOT NULL REFERENCES survey.campaigns(id) ON DELETE CASCADE,
  total_invited       int          DEFAULT 0,
  total_responded     int          DEFAULT 0,
  response_rate       numeric(5,2) DEFAULT 0,
  igrp                numeric(5,2),
  risk_distribution   jsonb,
  dimension_scores    jsonb,
  demographic_data    jsonb,
  heatmap_data        jsonb,
  top_critical_sectors jsonb,
  scores_by_gender    jsonb,
  scores_by_age       jsonb,
  top_critical_groups jsonb,
  calculated_at       timestamptz,
  created_at          timestamptz  DEFAULT now(),
  CONSTRAINT uq_campaign_metrics_campaign UNIQUE (campaign_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- core
CREATE INDEX idx_users_company_id ON core.users(company_id);
CREATE INDEX idx_refresh_tokens_user_id ON core.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON core.refresh_tokens(token);

-- survey
CREATE INDEX idx_campaigns_company_id ON survey.campaigns(company_id);
CREATE INDEX idx_campaigns_status ON survey.campaigns(status);
CREATE INDEX idx_campaign_units_campaign_id ON survey.campaign_units(campaign_id);
CREATE INDEX idx_campaign_sectors_unit_id ON survey.campaign_sectors(unit_id);
CREATE INDEX idx_campaign_positions_sector_id ON survey.campaign_positions(sector_id);
CREATE INDEX idx_campaign_employees_position_id ON survey.campaign_employees(position_id);
CREATE INDEX idx_campaign_employees_email_hash ON survey.campaign_employees(email_hash);
CREATE INDEX idx_survey_invitations_campaign_id ON survey.survey_invitations(campaign_id);
CREATE INDEX idx_survey_invitations_employee_id ON survey.survey_invitations(employee_id);
CREATE INDEX idx_survey_invitations_token_public ON survey.survey_invitations(token_public);
CREATE INDEX idx_survey_responses_campaign_id ON survey.survey_responses(campaign_id);
CREATE INDEX idx_survey_responses_session_uuid ON survey.survey_responses(session_uuid);

-- analytics
CREATE INDEX idx_fact_responses_campaign_id ON analytics.fact_responses(campaign_id);
CREATE INDEX idx_fact_responses_response_id ON analytics.fact_responses(response_id);
CREATE INDEX idx_fact_responses_dimension ON analytics.fact_responses(dimension);
CREATE INDEX idx_dim_sectors_campaign_id ON analytics.dim_sectors(campaign_id);
CREATE INDEX idx_campaign_metrics_campaign_id ON analytics.campaign_metrics(campaign_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- core
ALTER TABLE core.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- survey
ALTER TABLE survey.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.campaign_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.campaign_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.campaign_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.campaign_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.survey_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.survey_questions ENABLE ROW LEVEL SECURITY;

-- analytics
ALTER TABLE analytics.fact_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.dim_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.campaign_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HSE-IT QUESTIONS (35 items)
-- ============================================================================
INSERT INTO survey.survey_questions (question_number, dimension, question_text) VALUES
-- Demands (8 questions)
(1,  'DEMANDAS',      'Diferentes grupos no trabalho exigem de mim coisas que sao dificeis de conciliar'),
(2,  'DEMANDAS',      'Tenho prazos inatingiveis'),
(3,  'DEMANDAS',      'Tenho que trabalhar muito intensamente'),
(4,  'DEMANDAS',      'Tenho que negligenciar algumas tarefas porque tenho muito o que fazer'),
(5,  'DEMANDAS',      'Nao consigo ter pausas suficientes'),
(6,  'DEMANDAS',      'Sinto-me pressionado(a) a trabalhar alem do meu horario'),
(7,  'DEMANDAS',      'Sinto-me pressionado(a) a trabalhar em ritmo acelerado'),
(8,  'DEMANDAS',      'Tenho demandas de trabalho que considero desnecessarias'),

-- Control (6 questions)
(9,  'CONTROLE',      'Posso decidir quando fazer uma pausa'),
(10, 'CONTROLE',      'Tenho escolha para decidir o que faco no trabalho'),
(11, 'CONTROLE',      'Tenho escolha para decidir como faco meu trabalho'),
(12, 'CONTROLE',      'Tenho voz sobre meu ritmo de trabalho'),
(13, 'CONTROLE',      'Meu horario de trabalho pode ser flexivel'),
(14, 'CONTROLE',      'Posso opinar sobre como meu trabalho e organizado'),

-- Support from managers (5 questions)
(15, 'APOIO_GESTAO',  'Recebo informacoes e apoio do(a) meu(minha) gestor(a) direto(a)'),
(16, 'APOIO_GESTAO',  'Posso contar com meu(minha) gestor(a) direto(a) quando tenho problemas no trabalho'),
(17, 'APOIO_GESTAO',  'Recebo o apoio de que necessito do(a) meu(minha) gestor(a) direto(a)'),
(18, 'APOIO_GESTAO',  'Meu(minha) gestor(a) direto(a) esta disposto(a) a me ouvir sobre problemas no trabalho'),
(19, 'APOIO_GESTAO',  'Sou incentivado(a) pelo(a) meu(minha) gestor(a) direto(a)'),

-- Support from peers (4 questions)
(20, 'APOIO_PARES',   'Posso contar com a ajuda dos(as) meus(minhas) colegas de trabalho quando necessario'),
(21, 'APOIO_PARES',   'Recebo o respeito que mereco dos(as) meus(minhas) colegas no trabalho'),
(22, 'APOIO_PARES',   'Meus(minhas) colegas estao dispostos(as) a me ouvir sobre problemas no trabalho'),
(23, 'APOIO_PARES',   'Meus(minhas) colegas de trabalho me ajudam e apoiam'),

-- Relationships (4 questions)
(24, 'RELACIONAMENTOS','Estou sujeito(a) a assedio moral no trabalho'),
(25, 'RELACIONAMENTOS','Ha atritos ou raiva entre colegas no trabalho'),
(26, 'RELACIONAMENTOS','Sou alvo de comportamentos indesejados no trabalho'),
(27, 'RELACIONAMENTOS','As relacoes no trabalho sao tensas'),

-- Role (5 questions)
(28, 'PAPEL',         'Tenho clareza sobre o que se espera de mim no trabalho'),
(29, 'PAPEL',         'Sei o que tenho que fazer para cumprir minhas responsabilidades'),
(30, 'PAPEL',         'Tenho clareza sobre meus deveres e responsabilidades'),
(31, 'PAPEL',         'Compreendo como meu trabalho se encaixa nos objetivos da organizacao'),
(32, 'PAPEL',         'Recebo informacoes suficientes sobre os objetivos da organizacao'),

-- Change (3 questions)
(33, 'MUDANCA',       'Tenho oportunidades suficientes de questionar gestores sobre mudancas no trabalho'),
(34, 'MUDANCA',       'A equipe e consultada sobre mudancas no trabalho'),
(35, 'MUDANCA',       'Quando ocorrem mudancas no trabalho, tenho clareza de como elas funcionarao na pratica');
