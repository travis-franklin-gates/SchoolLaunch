export interface FinancialAssumptions {
  per_pupil_rate: number
  levy_equity_per_student: number
  benefits_load_pct: number
  authorizer_fee_pct: number
  salary_escalator_pct: number
  ops_escalator_pct: number
  supplies_per_student: number
  contracted_services_per_student: number
  technology_per_student: number
  insurance_annual: number
  contingency_pct: number
}

export const DEFAULT_ASSUMPTIONS: FinancialAssumptions = {
  per_pupil_rate: 15000,
  levy_equity_per_student: 1500,
  benefits_load_pct: 30,
  authorizer_fee_pct: 3,
  salary_escalator_pct: 2.5,
  ops_escalator_pct: 2,
  supplies_per_student: 200,
  contracted_services_per_student: 150,
  technology_per_student: 180,
  insurance_annual: 18000,
  contingency_pct: 2,
}

export function getAssumptions(raw: Partial<FinancialAssumptions> | null | undefined): FinancialAssumptions {
  if (!raw) return { ...DEFAULT_ASSUMPTIONS }
  return { ...DEFAULT_ASSUMPTIONS, ...raw }
}

export interface SchoolProfile {
  school_id: string
  region: string
  planned_open_year: number
  grade_config: string
  target_enrollment_y1: number
  target_enrollment_y2: number
  target_enrollment_y3: number
  target_enrollment_y4: number
  max_class_size: number
  pct_frl: number
  pct_iep: number
  pct_ell: number
  pct_hicap: number
  onboarding_complete: boolean
  financial_assumptions?: Partial<FinancialAssumptions> | null
}

export interface StaffingPosition {
  id?: string
  school_id: string
  year: number
  title: string
  category: 'certificated' | 'classified' | 'admin'
  fte: number
  annual_salary: number
  funding_source?: string
  notes?: string
}

export interface BudgetProjection {
  id?: string
  school_id: string
  year: number
  category: string
  subcategory: string
  amount: number
  is_revenue: boolean
  notes?: string
  updated_at?: string
}

export type GrowthPreset = 'conservative' | 'moderate' | 'aggressive' | 'manual'
