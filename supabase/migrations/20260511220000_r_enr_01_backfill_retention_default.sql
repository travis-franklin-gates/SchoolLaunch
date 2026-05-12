-- R-ENR-01 — Multi-year retention modeling fix (paired with code change in src/lib/gradeExpansion.ts)
--
-- Pre-fix engine behavior: `computeExpansionEnrollments` accepted a `retentionRate`
-- parameter but never used it. Schools' `retention_rate` of 100 (the hardcoded default
-- from GradeExpansionEditor.tsx) implied 100% year-over-year retention; the engine
-- silently produced full-capacity Y2-Y5 enrollment regardless.
--
-- Post-fix engine behavior: Formula A whole-year compounding retention. The engine
-- now applies retentionRate to continuing-grade students; new-grade-level students
-- enroll at full planned capacity.
--
-- This migration backfills the silent retention=100 default to 92 (the new calibrated
-- engine default) for planning-status schools, AND clears advisory_cache + the
-- dataHash property inside it (atomic — clearing the JSONB nulls the hash).
--
-- Authorized/exported schools (status='authorized' or 'exported') are NOT modified;
-- their retention_rate is preserved so prior Commission-facing models stay intact.
-- Their advisory_cache is cleared so AI agents regenerate with corrected F3 prose.
--
-- Migration was applied via Supabase MCP execute_sql on 2026-05-11 (during R-ENR-01
-- Phase 4.1). This file is recorded in the repo for future dev-environment schema sync.
--
-- Verification queries (post-migration counts confirmed at execution time):
--   planning + retention=92:  17 schools (16 newly updated + 1 Evergreen previously at 92)
--   planning + retention=100: 0 schools
--   planning + retention=90:  6 schools (seed/test schools, unchanged)
--   schools with non-null advisory_cache: 0

BEGIN;

-- A: Update planning + retention=100 → 92, null their cache
UPDATE school_profiles
SET retention_rate = 92, advisory_cache = NULL
WHERE retention_rate = 100
  AND school_id IN (SELECT id FROM schools WHERE status = 'planning');

-- B: Clear advisory_cache for all OTHER schools that still have it
-- (planning at non-100 retention values + any authorized/exported schools).
-- Update A already cleared retention=100 schools, so this completes the cache sweep.
UPDATE school_profiles
SET advisory_cache = NULL
WHERE advisory_cache IS NOT NULL
  AND retention_rate <> 100;

COMMIT;

-- Follow-up: F-001/F-011 and F-006 fixes (2026-05-11) also clear advisory_cache because
-- they affect agent prose. The cache is nullified again at deploy time as part of those
-- fixes' rollout, not via a separate migration — see r-enr-01-f001-f006-shipping.md.
