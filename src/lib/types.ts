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
