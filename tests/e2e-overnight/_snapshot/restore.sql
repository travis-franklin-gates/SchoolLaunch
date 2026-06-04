-- Guaranteed restore for test-columbia (school_id pinned = the only mutable account).
-- Restores every column the overnight suite can mutate to the Phase -1 snapshot.
-- advisory_cache / logo_url are intentionally excluded: no scenario touches them.
-- This is the canonical manual fallback; globalTeardown runs the equivalent.
UPDATE public.school_profiles SET
  grade_config = 'K-8',
  region = 'benton_county',
  planned_open_year = 2027,
  target_enrollment_y1 = 72,
  target_enrollment_y2 = 96,
  target_enrollment_y3 = 120,
  target_enrollment_y4 = 144,
  target_enrollment_y5 = 168,
  max_class_size = 24,
  pct_frl = 62, pct_iep = 13, pct_ell = 18, pct_hicap = 3,
  per_pupil_rate = 15000,
  lease_sqft = NULL, lease_rate_per_sqft = NULL, lease_monthly_flat = NULL,
  tuition_rate = NULL, financial_aid_pct = NULL,
  fiscal_year_start_month = 9,
  retention_rate = 92,
  onboarding_complete = true,
  opening_grades = '["K","1","2"]'::jsonb,
  buildout_grades = '["K","1","2","3","4","5","6","7","8"]'::jsonb,
  pre_opening_expenses = '[]'::jsonb,
  pre_opening_transactions = '[]'::jsonb,
  custom_revenue_lines = '[]'::jsonb,
  custom_expense_lines = '[]'::jsonb,
  custom_payment_schedule = NULL,
  facility_financing = NULL,
  startup_funding = '[{"type":"grant","amount":350000,"source":"Federal CSP Grant","status":"projected","selectedYears":[0,1,2,3,4],"yearAllocations":{"0":350000,"1":0,"2":0,"3":0,"4":0}}]'::jsonb,
  financial_assumptions = '{"aafte_pct":95,"per_pupil_rate":12000,"sped_per_pupil":4500,"contingency_pct":2,"insurance_annual":18000,"revenue_cola_pct":3,"benefits_load_pct":30,"ops_escalator_pct":2,"authorizer_fee_pct":3,"facilities_per_pupil":0,"food_service_offered":true,"regular_ed_per_pupil":12000,"salary_escalator_pct":2.5,"supplies_per_student":200,"interest_rate_on_cash":3,"regionalization_factor":1.02,"technology_per_student":180,"transportation_offered":false,"levy_equity_per_student":0,"food_service_per_student":1200,"transportation_per_student":800,"food_service_revenue_per_pupil":710,"contracted_services_per_student":150,"transportation_revenue_per_pupil":560}'::jsonb
WHERE school_id = '64b84ff8-2824-4ca4-9814-57fa39b23c26';
