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
  company_ids: z.array(z.string().uuid()).min(1).optional(),
});

export const campaignSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  description: z.string().optional(),
  start_date: z
    .string()
    .transform((val) => {
      // Accept both "YYYY-MM-DD" and full ISO strings
      if (val.includes('T')) return val; // already ISO, pass through
      return `${val}T00:00:00.000Z`;
    }),
  end_date: z
    .string()
    .transform((val) => {
      if (val.includes('T')) return val;
      return `${val}T23:59:59.000Z`; // end of day
    }),
  company_id: z.string().uuid(),
});

export const surveyResponseSchema = z.object({
  responses: z.record(z.string(), z.number().min(0).max(4)),
  gender: z.enum(['M', 'F', 'N'], { error: 'Selecione um sexo válido' }),
  age_range: z.string().min(1, 'Selecione uma faixa etária'),
  unit_id: z.string().uuid().optional(),
  sector_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
  validation_token: z.string().uuid('Token de acesso inválido'),
  consent_accepted: z.literal(true, { error: 'É necessário aceitar o termo de consentimento' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type UserInput = z.infer<typeof userSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
