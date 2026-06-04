-- R-REV-07: custom non-personnel expense lines for the WA Charter pathway.
-- Additive, mirror of the existing custom_revenue_lines column. Default '[]' so
-- every existing row and any `select *` is unaffected.
ALTER TABLE public.school_profiles
  ADD COLUMN IF NOT EXISTS custom_expense_lines jsonb NOT NULL DEFAULT '[]'::jsonb;
