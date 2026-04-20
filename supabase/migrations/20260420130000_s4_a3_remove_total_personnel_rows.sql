-- Session 4 Track A3 (AUDIT follow-up): remove the dead "Total Personnel"
-- rows from budget_projections. Personnel totals are live-computed from
-- staffing_positions in budgetEngine.ts — the persisted rows were stale
-- on any staffing edit. Onboarding insert and staffing-page update paths
-- have been removed in the same commit. No CHECK constraint added: the
-- constraint would be a defence-in-depth that duplicates a removed write
-- path, and future callers should fail at code review, not runtime.
DELETE FROM public.budget_projections
WHERE category = 'Personnel'
  AND subcategory = 'Total Personnel';
