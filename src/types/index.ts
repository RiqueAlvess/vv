// ============================================================
// Core Domain Types for Psychosocial Risk Analysis System
// ============================================================

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  cnae: string | null;
  logo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  company_id: string;
  company_name?: string;
  companies?: { id: string; name: string }[];
  name: string;
  email: string;
  role: 'ADM' | 'RH' | 'LIDERANCA';
  sector_id?: string;
  active: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'closed';
  campaign_salt: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignUnit {
  id: string;
  campaign_id: string;
  name: string;
}

export interface CampaignSector {
  id: string;
  unit_id: string;
  name: string;
}

export interface CampaignPosition {
  id: string;
  sector_id: string;
  name: string;
}

export interface CampaignQRCode {
  id: string;
  campaign_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  deactivated_at: string | null;
}

export interface SurveyResponse {
  id: string;
  campaign_id: string;
  session_uuid: string;
  unit_id: string | null;
  sector_id: string | null;
  position_id: string | null;
  gender: string | null;
  age_range: string | null;
  consent_accepted: boolean;
  responses: Record<string, number>;
  created_at: string;
}

export interface CampaignEmployee {
  id: string;
  campaign_id: string;
  cpf_hash: string | null;
  has_responded: boolean;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  question_number: number;
  dimension: string;
  question_text: string;
}

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  total_employees: number;
  total_invited: number;
  total_responded: number;
  response_rate: number;
  igrp: number;
  risk_distribution: Record<string, number>;
  dimension_scores: Record<string, number>;
  demographic_data: Record<string, unknown>;
  heatmap_data: Record<string, unknown>;
  top_critical_sectors: Record<string, unknown>[];
  scores_by_gender: Record<string, unknown>;
  scores_by_age: Record<string, unknown>;
  top_critical_groups: Record<string, unknown>[];
  calculated_at: string;
}

// ============================================================
// Utility Types
// ============================================================

/** Per-dimension NR averages returned by the group-breakdown endpoints. */
export type DimensionData = Record<string, number>;

export type DimensionType =
  | 'demandas'
  | 'controle'
  | 'apoio_chefia'
  | 'apoio_colegas'
  | 'relacionamentos'
  | 'cargo'
  | 'comunicacao_mudancas';

export type RiskLevel = 'aceitavel' | 'moderado' | 'importante' | 'critico';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface JWTPayload {
  user_id: string;
  email: string;
  role: 'ADM' | 'RH' | 'LIDERANCA';
  company_id: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CSVRow {
  unidade: string;
  setor: string;
  cargo: string;
  cpf: string;
}

export interface DashboardData {
  metrics: CampaignMetrics;
  dimension_scores: Record<string, number>;
  radar_data: Record<string, unknown>[];
  top_sectors: Record<string, unknown>[];
  risk_distribution: Record<string, number>;
  gender_distribution: Record<string, number>;
  age_distribution: Record<string, number>;
  heatmap: Record<string, unknown>;
  scores_by_gender: Record<string, unknown>;
  scores_by_age: Record<string, unknown>;
  top_critical_groups: Record<string, unknown>[];
}
