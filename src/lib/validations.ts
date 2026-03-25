import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const companySchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cnpj: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .pipe(z.string().length(14, 'CNPJ deve ter 14 dígitos')),
  cnae: z.string().optional(),
});

export const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  role: z.enum(['ADM', 'RH', 'LIDERANCA']),
  company_id: z.string().uuid(),
});

export const campaignSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  description: z.string().optional(),
  start_date: z.string(),
  end_date: z.string(),
  company_id: z.string().uuid(),
});

export const surveyResponseSchema = z.object({
  responses: z.record(z.string(), z.number().min(0).max(4)),
  gender: z.string().optional(),
  age_range: z.string().optional(),
  consent_accepted: z.literal(true, { error: 'É necessário aceitar o termo de consentimento' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type UserInput = z.infer<typeof userSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
