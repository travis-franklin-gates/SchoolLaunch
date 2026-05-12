# R-ENR-01 — Phase 3 Report (UI Fix)

**Date:** 2026-05-11
**Status:** Phase 3 complete. F1 + Multi-Year copy fix + onboarding default + Settings slider all shipped. Awaiting Travis greenlight on Phase 4 (DB backfill + comms + docs).

---

## Summary

Phase 3 closes the F1 UI loop: GradeExpansionEditor now respects the stored retention_rate and exposes a slider for user adjustment. The buildout-decline addition to F3 prose (leftover Phase 2 deliverable) also shipped here. End-to-end flow verified: user moves slider → save → DB writes → Multi-Year dashboard reflects new trajectory.

## Files changed

| File | Change |
|---|---|
| `src/lib/buildSchoolContext.ts` | **Phase 2 leftover:** appended buildout-decline sentence to F3 prose at lines 213 and 377 |
| `src/components/GradeExpansionEditor.tsx` | Imported `RETENTION_RATE_DEFAULT`. Converted `const retentionRate = 100` to `useState<number>(initialRetentionRate ?? RETENTION_RATE_DEFAULT)`. Added slider UI (range 70-100, step 1) after the Expansion Timeline section, with the full D4 tooltip (including buildout-decline mirror) and value display in tabular-nums. |
| `src/app/(onboarding)/onboarding/page.tsx` | Imported `RETENTION_RATE_DEFAULT`. Changed initial wizard state `retentionRate: 100` to `retentionRate: RETENTION_RATE_DEFAULT`. |
| `src/app/(authenticated)/dashboard/multiyear/page.tsx` | Y1 cell in "New Grade Students" row: replaced `y.enrollment` (showing 72) with `'—'`. Y1 still appears in Total Enrollment row as 72; no information lost. |

**Not touched (per scope discipline):**
- `src/app/(authenticated)/dashboard/settings/page.tsx` — already passes `initialRetentionRate={profile.retention_rate ?? undefined}`, which correctly flows through the new useState fallback. No edit needed.
- `src/components/onboarding/StepEnrollment.tsx` — already passes `initialRetentionRate={initialData.retentionRate}` to GradeExpansionEditor. No edit needed.
- All Generic-pathway code (`computeGenericProjections` etc.). Untouched.

## End-to-end verification

### Unit tests
- `npx playwright test tests/session4/grade-expansion.spec.ts` — **18/18 passing** in 1.5s. Same suite that proved Phase 2; confirms no regression from Phase 3 UI/onboarding edits.

### Browser verification (Playwright, dev server localhost:3000)

**Multi-Year Y1 copy fix:**

| Row | Y1 | Y2 | Y3 | Y4 | Y5 |
|---|---|---|---|---|---|
| Returning Students | — | 66 | 83 | 98 | 112 |
| New Grade Students | **— (was 72)** | +24 | +24 | +24 | — |
| Total Enrollment | 72 | 90 | 107 | 122 | 112 |

Founding cohort context now reads consistently: Returning="—" + NewGrade="—" → Total=72 (founding cohort, implicit).

**Slider on Settings (retention=92 in DB):**

| Property | Value |
|---|---|
| Slider value | 92 |
| Min / Max / Step | 70 / 100 / 1 |
| Label | "Annual Retention Rate" |
| Tooltip | Full D4 text + buildout-decline addendum (rendered via Tooltip component) |
| Display | "92%" in tabular-nums; "Default 92% — WA charter elementary range 90–95%" in legend |
| Screenshot | `.audit-tmp/audit-12-renr01-p3-settings-slider.png` |

**3b read-path verification (3 cases):**

| Case | DB state | Expected slider | Actual |
|---|---|---|---|
| (a) Stored number | retention_rate = 92 | 92 | **92 ✓** |
| (b) Stored NULL | retention_rate = NULL | 92 (fallback) | **92 ✓** |
| (c) Missing column value (≈ undefined on JS object) | n/a — column always exists; equivalent to (b) at code level via `??` chain | 92 (fallback) | **logically identical to (b) ✓** |

For case (c), the schema has `retention_rate` as a top-level column (not JSONB), so "missing key" doesn't apply in the strict sense. The closest equivalent — `profile.retention_rate` being undefined on the JS object — flows through `profile.retention_rate ?? undefined` in Settings → editor's `useState(undefined ?? 92)` → 92. Identical to case (b).

**Slider → Save → DB → Multi-Year round trip:**

1. Settings: dragged slider 92 → 88, native React-aware events fired
2. Slider value display updated to "88%"
3. Clicked Grade Expansion section's Save button
4. Supabase query confirmed `school_profiles.retention_rate = 88`
5. Navigated to Multi-Year
6. Enrollment trajectory recalculated: `[72, 87, 101, 113, 99]` — matches `round(prior × 0.88)` compounding precisely
7. Returning row: `[—, 63, 77, 89, 99]` — also matches
8. Restored to retention=92 (Evergreen's known-good state)

## Constraints honored

- WA pathway only — no Generic pathway code touched
- `computeMultiYearDetailed` interface unchanged
- No schema changes (still Phase 4)
- No git operations
- Supabase project ref verified `nlvlrznhiwuorxlapnej`, only school touched is Evergreen Heights (`7d82e5d1-...`)
- Tooltip text mirrors verbatim between Settings and onboarding Step 2 (same component, single source of truth)

## What Phase 4 inherits

The Phase 1.3 backfill plan now has a verified UI to call back to. Backfill SQL will write retention_rate=92 to planning-status schools currently at 100; Settings slider will show that 92 on next visit and the founder can adjust.

Specifically still pending in Phase 4:
- DB backfill migration (planning schools at retention=100 → 92; null `advisory_cache` + `advisory_data_hash` for ALL affected schools including authorized/exported so AI context regenerates with the corrected F3 prose)
- In-app banner for authorized/exported schools whose models were generated under the broken engine
- ESWA communication draft (`.audit-tmp/eswa-r-enr-01-notice.md`)
- BACKLOG.md update (mark R-ENR-01 RESOLVED)
- v4.0 spec update notes

## Sub-findings logged

None in this phase. The pre-existing fill-forward bug in `expansionToEnrollmentArray` (logged in Phase 2) was the only related-but-distinct finding surfaced during R-ENR-01, and it was fixed in Phase 2.

`.audit-tmp/r-enr-01-related-findings.md` was not created — no findings warranting it surfaced.

## STOP — Phase 3 complete

Awaiting Travis greenlight on Phase 4 (DB backfill + comms + spec/backlog updates).
