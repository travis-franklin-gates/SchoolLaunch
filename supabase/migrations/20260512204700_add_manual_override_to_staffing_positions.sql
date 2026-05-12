-- Add manual_override flag to staffing_positions (Bug 2 / Option A1 — 2026-05-12).
--
-- BEFORE THIS MIGRATION:
-- Per-pupil-driver positions (driver = 'per_pupil', 'per_pupil_el', etc.) had Y2-Y5
-- FTE inputs disabled in the Staffing tab per the P-UX-03 fix (commit bc7ab5a,
-- 2026-05-12). Founders had to toggle a position's driver to 'fixed' to override
-- any per-pupil-calculated FTE value.
--
-- AFTER THIS MIGRATION:
-- All FTE cells in the Staffing tab become editable regardless of driver. When a
-- founder manually overrides a per-pupil cell, that (school_id, position_type, year)
-- row's manual_override is set to true. Recompute paths in the Staffing UI —
-- recomputePerPupilFte (Y1 → Y2-Y5 derive), selectPositionType (type change),
-- toggleDriver (fixed ↔ per_pupil) — skip flagged indices so user-typed values
-- survive across recalculation.
--
-- ENGINE IMPACT: zero.
-- budgetEngine.ts and scenarioEngine.ts read p.fte and p.annual_salary only;
-- neither file references manual_override. The flag is UI-state only and rides
-- with the position row through save() / reload() / useEffect rebuild.
--
-- DATA IMPACT: zero.
-- All existing rows default to manual_override = false (no founder has manually
-- overridden anything yet via this UI). New rows default to false; the UI flips
-- the flag to true only when a founder edits a per-pupil Y2-Y5 cell directly.
--
-- Migration applied via Supabase MCP apply_migration on 2026-05-12.

BEGIN;

ALTER TABLE staffing_positions
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false;

COMMIT;
