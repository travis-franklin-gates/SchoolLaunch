# R-ENR-01 — Related Findings (Out-of-Scope Discoveries)

Findings surfaced during R-ENR-01 work that are real but deliberately not addressed in this fix.
Log them here cleanly; triage separately.

---

## RF-1 — Orphaned `schools` row with no `school_profiles`

**Surfaced:** Phase 4 preview count, 2026-05-11.

**Symptom:** `schools` table has 24 rows; `school_profiles` table has 23 rows. One `schools` row is missing its profile.

**Implication:** Most production queries join `schools` → `school_profiles`. For the orphaned row, the join returns empty, so the school is effectively invisible to:
- Dashboard pages (`useSchoolData` returns null profile)
- Multi-year computations (`computeMultiYearDetailed` needs profile)
- Advisory agents
- Exports (PDF, Excel)
- Likely the school's owner can sign in but the dashboard is broken

**Likely root causes (not investigated in this fix):**
- Incomplete cascade delete (a `school_profiles` row deleted without removing the parent `schools` row)
- An onboarding flow that created `schools` but errored before `school_profiles` insert
- Manual seed-script run that wrote `schools` only

**Diagnostic query:**
```sql
SELECT id, name, status, organization_id, created_at
FROM schools
WHERE id NOT IN (SELECT school_id FROM school_profiles)
ORDER BY created_at DESC;
```

**Recommended action (separate ticket):**
1. Identify the orphan via the diagnostic query
2. Check if it has any owner in `user_roles` (active founder vs. abandoned test account)
3. If active founder: restore the `school_profiles` row from onboarding defaults and notify
4. If abandoned: delete the `schools` row to clean up

**Pre-May-19 severity:** Low unless that orphan is an active founder. Triage via the diagnostic query before deciding urgency.

**Why not in R-ENR-01 scope:** Unrelated to retention modeling. Including it would dilute the R-ENR-01 fix and break the single-cause discipline.

---

## RF-2 — `scenarios.base_data_hash` will mismatch post-R-ENR-01 for all schools with stored scenarios

**Surfaced:** Phase 4 migration planning, 2026-05-11.

**Symptom:** Existing rows in the `scenarios` table cache `results`, `ai_analysis`, and `base_data_hash`. The engine fix in R-ENR-01 Phase 2 changes the inputs the hash is computed from (specifically, multi-year enrollment trajectories), so `base_data_hash` will mismatch the recomputed hash on next visit.

**Implication:** The Scenarios tab's existing staleness mechanism should detect the mismatch and prompt the user to recompute. This is the system's designed behavior and likely correct.

**Why not in R-ENR-01 migration scope:** The staleness detector handles this naturally. Force-clearing `scenarios.results` and `scenarios.ai_analysis` in the migration would over-reach — the user might want to compare the prior (buggy) result against the new (correct) result before discarding. Letting staleness flag it and letting the user click "recompute" is more transparent.

**Recommended action:** Verify during Phase 5 verification (Spokane Arts Academy) that opening the Scenarios tab post-migration triggers the stale indicator correctly. If it doesn't, follow up with a clearing operation in a Phase 4.5 patch.

**Pre-May-19 severity:** Medium. Founders who rely on Scenarios outputs will see stale data until they recompute, but the staleness indicator should make this obvious.

**Part 3 audit verification dependency:** When the Evergreen Heights audit resumes (Part 3 tab-by-tab), the Scenarios tab MUST be explicitly tested for the following: opening Scenarios for a school whose `base_data_hash` was computed pre-R-ENR-01 should trigger the staleness detector and prompt recomputation. If a founder lands on Scenarios with stale results numbers AND no recompute trigger, that's a Part 3 regression worth catching. This is the verification gate for the "trust the staleness mechanism" decision made in Phase 4.

---

## RF-3 — Spec-vs-implementation mismatch on advisory_data_hash

**Surfaced:** Phase 4 migration planning, 2026-05-11.

**Symptom:** v4.0 spec Section 14.1 documents the advisory cache clear pattern as:
```
UPDATE school_profiles SET advisory_cache = NULL, advisory_data_hash = NULL
```

But `advisory_data_hash` is not a column on `school_profiles`. Schema query confirms only `advisory_cache (jsonb)` exists. The hash is stored as a property INSIDE the JSONB (`AdvisoryCache.dataHash` per `types.ts:152-165`).

Setting `advisory_cache = NULL` atomically clears both the cache AND its embedded hash. No separate column operation is needed or possible.

**Severity:** Low. Documentation mismatch only — runtime code does the right thing.

**Recommended action (separate ticket):** Update v4.0 spec section 14.1 to reflect actual schema. Drop the `advisory_data_hash` reference.

**Note:** The related column `scenarios.base_data_hash` does exist on the `scenarios` table — that's the scenario-staleness-detector hash. Possibly the source of the spec confusion.

---

## RF-4 — R-ENR-01 in-app banner: deferred to follow-up

**Surfaced:** Phase 4.2, 2026-05-11. Per Travis's explicit allowance to defer if per-user dismissal requires schema work.

**Context:** The R-ENR-01 prompt called for an in-app banner for schools with status `authorized` or `exported`, explaining that enrollment modeling has been updated and prompting CEOs to review their retention assumption in Settings → Grade Expansion.

**Why deferred:**
1. **Zero current targets.** Post-migration verification confirmed 0 authorized + 0 exported schools in the current DB. The banner has no audience today.
2. **Schema work required for per-user dismissal.** The existing `user_roles` table has `tour_completed` (the Joyride dismissal) but no general notice-dismissal infrastructure. Per-user-per-school dismissal needs either a new column (`dismissed_notices jsonb` or `dismissed_notices text[]`) on `user_roles` OR a new `dismissed_notices` table. Either is a migration that needs RLS rules + an API endpoint to record dismissals.
3. **Scope discipline.** R-ENR-01 is enrollment retention modeling. Banner infrastructure for general-purpose user notices is a separate concern; building it now would be over-scope.

**Implementation plan when the time comes (e.g., when a school approaches authorization):**

**Schema:**
```sql
ALTER TABLE user_roles ADD COLUMN dismissed_notices text[] DEFAULT '{}' NOT NULL;
-- RLS: users can read/update their own dismissed_notices column only
```

**API:** `POST /api/user/dismiss-notice` with `{ noticeId: 'r-enr-01-2026-05-11' }` — appends to caller's `dismissed_notices` for the currently selected school.

**Component:** `<NoticeBanner noticeId="r-enr-01-2026-05-11">` reads from useUserRoles hook (currently selected school), shows banner if `!dismissedNotices.includes(noticeId)`. Dismissal calls the API + optimistically updates local state.

**Targeting filter:** Show only for schools with `status IN ('authorized', 'exported')` whose `school_profiles.updated_at` predates the R-ENR-01 fix date (so newly-authorized schools post-fix don't see it).

**Suggested banner text (factual, bounded):**
> "SchoolLaunch's multi-year enrollment modeling has been updated to apply realistic year-over-year retention. Your previous projections assumed 100% student retention; the current model applies the value in Settings → Grade Expansion. Review your retention assumption to confirm it matches your school's expected attrition profile."

**Pre-May-19 severity:** None (no current targets). Becomes relevant only when the first school transitions to authorized status — well after May-19.

**Pickup signal:** Once `SELECT count(*) FROM schools WHERE status IN ('authorized', 'exported') > 0`, flip this from deferred to in-progress.

---

## Phase 5 verification additions (for Part 3 audit when it resumes)

Travis flagged these post-R-ENR-01 verification targets to add to the Part 3 tab-by-tab audit checklist. They're not new findings — they're verification gates for the R-ENR-01 fix.

### Advisory Panel tab — high-signal verification surface

Visiting the Advisory Panel for Evergreen Heights post-fix will trigger first-time agent regeneration (since the migration nulled the `advisory_cache`). Specific checks:

1. **All 7 agents return without error:** Commission Reviewer, Enrollment Realist, Staffing Advisor, Compliance Officer, Operations Analyst, Board Finance Chair, SchoolCFO Advisor.
2. **Agent output references retention / attrition in ways consistent with the corrected `buildSchoolContext` prose** — not the old "attrition backfilled through new student recruitment" language. Pull the raw output and grep for that phrase as a regression guard.
3. **Commission Reviewer specifically:** does it engage with the 92% retention assumption as realistic for a WA charter elementary applicant? If the agent doesn't reference retention at all, that's a separate finding about agent prompts not pulling the right context signals.
4. **Enrollment Realist:** does it cite the year-over-year trajectory `[72, 90, 107, 122, 112]` (or close) and discuss its realism vs. WA charter benchmarks?
5. **`advisory_cache` repopulation:** verify via Supabase that the cache is non-null after the visit, with a new `dataHash` distinct from any value seen pre-fix.

Capture screenshots specifically of the first agent regeneration.

### Scenarios tab — staleness detector verification

Per RF-2 above. Specifically: open the Scenarios tab for any school with stored scenarios (Evergreen if it has any, or another seed school). Confirm the staleness indicator fires. If it doesn't, file as a Part 3 regression — the "trust the staleness mechanism" decision in Phase 4 was contingent on it actually firing.

