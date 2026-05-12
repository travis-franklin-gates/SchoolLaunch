# SchoolLaunch Backlog

Living list of known product, UX, and test-infra issues that are **not blocking
shipping** but need a home so they don't get lost. New items land here with a
status, context, and proposed fix — work gets promoted into a session plan or
audit when it's time to address them.

## Status legend

| Status          | Meaning                                                          |
| --------------- | ---------------------------------------------------------------- |
| `OPEN`          | Reproducible, root cause unknown or not yet investigated         |
| `INVESTIGATING` | Actively being diagnosed; has an owner or is in a session plan   |
| `DEFERRED`      | Root cause understood, fix intentionally postponed (low impact)  |
| `RESOLVED`      | Fixed — keep the entry until the next backlog cleanup pass       |

Entries stay under their category and are dated (`Opened: YYYY-MM-DD`) so the
list stays interpretable as the project ages.

---

## Product / UX

### P-UX-01 · Revenue tab: numeric input edits don't persist across reload
**Status:** `OPEN` · **Opened:** 2026-04-21 · **Source:** Cedar Ridge E2E, Phase 8

A founder on `/dashboard/revenue` edits the first numeric input (per-pupil
override), the change appears to save (no error toast, Save button resolves),
but after `page.reload()` the input reads back empty — not the original value,
not the edit, literally empty. Playwright assertion:

```
Expected: "1"
Received: ""
```

**Candidate root causes (not yet eliminated):**
1. Autosave hasn't completed its round-trip before reload — race.
2. `input[type="number"]` locator identity drifts on rehydrate; the test is
   reading a different element than it wrote.
3. The field re-derives from source data on mount, discarding the override.

**Proposed next step:** open the page manually, edit a numeric input, reload,
inspect network panel during save + on rehydrate, and the React tree to see
whether the field is controlled by persisted state or a derivation.

**Test impact:** Phase 8 is currently skipped in `full-founder-journey.spec.ts`
via `PHASES_8_PLUS_SKIPPED`. Unskipping gated on this being root-caused.

---

### P-UX-02 · Joyride guided tour auto-launches on first dashboard visit
**Status:** `OPEN` · **Opened:** 2026-04-21 · **Source:** Cedar Ridge E2E, Phase 7

`react-joyride` renders a full-page overlay (`data-test-id="overlay"` inside
`#react-joyride-portal`) that intercepts pointer events. Any click on the
dashboard — including sidebar tab links — hangs on "subtree intercepts pointer
events" until the overlay is dismissed.

The E2E test currently masks this via a `dismissJoyrideIfPresent(page)` helper,
but that's a band-aid — real founders on slow connections have hit the same
race (overlay renders before hydration completes, user clicks through it, tour
state is lost mid-flight).

**Proposed fix (pick one, probably 1 + 3):**
1. Gate auto-launch on a `tour_completed`-style signal that flips to `true`
   the first time the user interacts with ANY sidebar link.
2. Add `?skipTour=1` query param and an env-gated test hook so E2E doesn't
   need the helper.
3. Lower the overlay's `z-index` / disable pointer intercept on the sidebar
   region so navigation works even when the tour is visible.

**Test impact:** Phases 8–13 (sidebar-heavy) currently skipped — flakiness
risk from overlay races. Unskipping gated on this being resolved.

---

### P-UX-03 · Staffing: position "driver" field not editable from UI
**Status:** `OPEN` · **Opened:** 2026-04-21

Each of the 27 Commission-aligned positions has a `driver` column
(enrollment-based, section-based, fixed, etc.) that determines how the
position scales across years in the multi-year projection. The driver is
currently seeded from `COMMISSION_POSITIONS` in `src/lib/types.ts` and is
not exposed in the Staffing tab UI — founders can't override it even when
their school's staffing model intentionally differs (e.g., a dean position
that should scale with sections, not enrollment).

**Proposed fix:** surface `driver` as an inline dropdown on the staffing
row, with the default value pre-selected and a warning tooltip when the
founder deviates from the Commission default ("Commission models this role
on enrollment — override only if your staffing plan justifies").

---

### P-UX-04 · `GradeExpansionEditor`: students-per-section input rendered in 3 places
**Status:** `DEFERRED` · **Opened:** 2026-04-21 · **Source:** noted in
`full-founder-journey.spec.ts` header comment

`src/components/onboarding/GradeExpansionEditor.tsx` renders the SPS value in:

1. A "consistent class size" input gated by a checkbox (lines 347 / 362).
2. Per-grade inputs in the "Year 1 Grade Configuration" founding table
   (line 400).
3. Per-grade inputs in the "Grade Expansion Plan" full timeline table
   (line 513).

Tables 2 and 3 both edit Year 1 rows — overlapping overrides on the same
`planOverrides` Map keyed by `${year}-${grade}`. A founder who edits Y1
in Table 2, then opens Table 3 and edits it again, will see their first
change silently replaced. Conversely, checking "consistent class size"
masks per-grade edits without warning.

**Deferred because:** no reported user confusion in onboarding sessions; the
most common flow (WA charter defaults at 24) skips this surface entirely.

**Proposed fix (when picked up):** collapse to a single source of truth —
probably Table 2 — and render Tables 1 and 3 as read-only projections of
that state, or gate them behind an "override Y1" toggle that clearly
signals which surface wins.

---

### P-UX-05 · Settings → Danger Zone: copy + CTA labels inconsistent
**Status:** `RESOLVED` · **Opened:** 2026-04-21
**Resolved:** 2026-04-21 — Dialog body rewritten, confirm button changed to "Reset School Data", name-typing confirmation retained. See commit touching `src/app/(authenticated)/dashboard/settings/page.tsx`.
The in-app Danger Zone is a RESET (clears school financial data, routes the
user back to `/onboarding`), not a DELETE. The current copy and button
labels don't make that distinction clearly:

- Trigger button: "Reset School… start over" (ambiguous — sounds like delete)
- Modal header: references "permanently" in some paths
- Confirm button: "Reset School Data" (clear) vs historical "Permanently
  Reset" (implies deletion)

Founders have misread this as "delete my school" during live demos. Hard
deletion is service-role-only by design; the UI surface should make that
contract explicit.

**Proposed fix:** rename trigger to "Reset School Data", drop
"permanently" language, and add a one-line explainer under the button
("Clears financial data and returns you to onboarding. Your account and
school record are preserved.").

---

### RF-4 · R-ENR-01 in-app banner: deferred (zero current targets)
**Status:** `DEFERRED` · **Opened:** 2026-05-11 · **Source:** R-ENR-01 Phase 4.2

The R-ENR-01 prompt called for an in-app banner targeting schools with status `authorized` or `exported`, prompting CEOs to review their retention assumption. Post-migration count of authorized + exported schools = 0, so the banner has no current audience.

Per-user-per-school dismissal (required so multiple team members on one school can independently acknowledge) needs new schema: either a column on `user_roles` (`dismissed_notices jsonb` or `text[]`) or a new `dismissed_notices` table, plus an API endpoint and a `NoticeBanner` component. Non-trivial to build for zero users.

**Pickup signal:** when `SELECT count(*) FROM schools WHERE status IN ('authorized', 'exported') > 0`, flip to in-progress.

**Implementation plan when picked up:** see `.audit-tmp/r-enr-01-related-findings.md` RF-4 for full schema, API, component, and banner-text design notes.

---

### P-UX-06 · `StepIdentity`: opening-year dropdown is a rolling 4-year window
**Status:** `DEFERRED` · **Opened:** 2026-04-21

`src/components/onboarding/StepIdentity.tsx:13` derives the opening-year
options as:

```ts
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear + i)
```

This rolls forward every calendar year. A founder who picks year `N+3`
and comes back 18 months later will find that value no longer in the
dropdown — the field silently resets or shows a stale selection with no
matching option.

**Deferred because:** impact is narrow (founders typically complete
onboarding within weeks, not years) and the E2E test works around it by
selecting `currentYear + 1`.

**Proposed fix:** when loading a saved school profile, union the saved
`opening_year` into `YEARS` so the user's existing choice is always
representable. Optionally widen the default window to 6 years forward.

---

## Test Infrastructure

### T-INFRA-01 · No isolated Supabase test environment
**Status:** `DEFERRED` · **Opened:** 2026-04-21

`full-founder-journey.spec.ts` hits the live Supabase project
(`nlvlrznhiwuorxlapnej`) and the live Anthropic API. Every run:

- Creates a real auth user + school row
- Burns Anthropic tokens (briefing, advisory panel, scenarios AI,
  alignment review, Ask SchoolLaunch)
- Leaves cleanup exposure — if Phase 14b fails, a real orphan persists
  in production data until manually purged

**Deferred because:** no current budget to spin up a dedicated Supabase
project + seed data; Anthropic cost per run is tolerable.

**Proposed fix (future):** create a `schoollaunch-e2e` Supabase project
mirroring prod schema; swap `NEXT_PUBLIC_SUPABASE_URL` via env in the
Playwright config; mock or stub the Anthropic endpoints used in smoke
tests.

---

### T-INFRA-02 · Manual orphan-purge fallback when Phase 14b fails
**Status:** `OPEN` · **Opened:** 2026-04-21

When the hard-delete phase fails (service-role auth error, flaky network,
assertion thrown after partial delete), the test prints a
`🚨 CLEANUP INCOMPLETE` banner with the school_id + user_id, but there is
no automated recovery — Travis has to purge via the Supabase MCP manually.

**Proposed fix:** a `scripts/purge-orphan.ts` that takes a school_id and
walks the standard deletion order (staffing_positions → budget_projections
→ scenarios → grade_expansion_plan → org_notes → invitations → user_roles
→ school_profiles → schools → auth.users), usable as a one-liner from the
CI log output.

---

### T-INFRA-03 · `dismissJoyrideIfPresent` helper is load-bearing
**Status:** `INVESTIGATING` · **Opened:** 2026-04-21

See **P-UX-02** — the Joyride overlay intercepts clicks. The current
helper tries four selectors in order (Close button, Skip button,
`data-test-id="button-skip"`, role-based "Skip tour"), each with a 2s
timeout, and silently moves on if none appear.

That works for Phase 7, but it makes downstream tab navigation (Phases
8–13) subtly fragile — any re-trigger of the tour (e.g., route change
resets tour state) surfaces the overlay mid-step without the helper
being invoked.

**Proposed fix:** resolve **P-UX-02** at the product level, then delete
this helper.

---

## Enrollment engine — resolved

### R-ENR-01 · Multi-year retention modeling: hardcoded UI + dead engine parameter + false AI prose
**Status:** `RESOLVED` · **Opened:** 2026-05-11 · **Resolved:** 2026-05-11 · **Source:** Evergreen Heights baseline audit, Part 2 checkpoint

Three compounding bugs discovered during the Evergreen Heights baseline audit, fixed together as a single paired-fix release. All multi-year projections produced before this fix assumed 100% year-over-year student retention regardless of what `school_profiles.retention_rate` stored.

**F1 (UI):** `src/components/GradeExpansionEditor.tsx:64` hardcoded `const retentionRate = 100`. The component's `initialRetentionRate` prop was destructured (line 38) but never consumed, and a `useEffect` (lines 196–204) pushed `retentionRate: 100` to the parent on every render — overwriting any DB value the moment the editor opened. No UI control existed for the user to set retention ≠ 100.

**F2 (engine, critical):** `src/lib/gradeExpansion.ts:180–205` `computeExpansionEnrollments` accepted a `retentionRate` parameter but never referenced it in the function body. The comment on the math line read "Total = full planned capacity." Five upstream readers (`budgetEngine.ts:494, 1076`; `buildSchoolContext.ts:206, 365`; `staffing/page.tsx:285`; `staffing/seed/route.ts:107`; `StepEnrollment.tsx:154`) plumbed `retention_rate` through to this dead receiver. The same pattern existed in `expansionToEnrollmentArray:227–245`. Pre-existing fill-forward bug in `expansionToEnrollmentArray` (conflated "year has no entries" with "year computed to 0") was also fixed in the same surface.

**F3 (AI advisory):** `buildSchoolContext.ts:213, 375` emitted prose to the AI advisory layer that described attrition modeling the engine didn't implement: `"Growth model: Grade expansion with X% cohort retention (Y% annual attrition backfilled through new student recruitment)"`. Agents were reasoning about a model that didn't exist in the math.

**Fix (Formula A whole-year compounding):**
- `computeExpansionEnrollments` now applies retention to the prior year's RESULT total (compounding), with new-grade-level students at full planned capacity.
- Single `RETENTION_RATE_DEFAULT = 92` constant in `gradeExpansion.ts`, accessed via `getRetentionRate(profile)` helper. All callers updated to use the accessor.
- `GradeExpansionEditor` now uses `useState(initialRetentionRate ?? RETENTION_RATE_DEFAULT)` and exposes a slider (range 70–100, step 1, D4-spec tooltip including buildout-decline note). Slider lives inside the editor so it appears on both Settings and onboarding Step 2.
- Onboarding initial wizard state writes `RETENTION_RATE_DEFAULT` (92), not the prior hardcoded 100.
- Multi-Year tab Y1 cell in "New Grade Students" row shows "—" (founding cohort isn't a "new grade" in the expansion-plan sense).
- F3 prose rewritten at both context-builder sites to factually describe Formula A, including the Y5-may-decline-below-Y4 disclaimer once buildout completes.

**Regression test:** `tests/session4/grade-expansion.spec.ts` — 13 new test cases: retention=100 legacy guard `[72, 96, 120, 144, 144]`, retention=92 default `[72, 90, 107, 122, 112]`, retention=90, retention=0 edge case, constituent-sum invariant (`total = returning + newGrade` for Y2+), new-grade-not-subject-to-retention invariant, compounding verification, accessor null-fallback. 18/18 tests passing.

**DB backfill:** 16 planning-status schools at retention=100 migrated to 92; 12 schools' `advisory_cache` cleared (the JSONB blob includes the `dataHash` property, so cache + hash invalidation is atomic). Migration ran in a BEGIN/COMMIT transaction. Authorized/exported schools count = 0, so no preservation case currently active.

**Related findings** (logged separately in `.audit-tmp/r-enr-01-related-findings.md`): RF-1 (orphan school), RF-2 (scenarios staleness verification), RF-3 (spec/schema mismatch on `advisory_data_hash`), RF-4 (banner deferred — zero current targets).

**Phase artifacts:** `.audit-tmp/r-enr-01-phase1.md`, `phase2.md`, `phase3.md`, `r-enr-01-related-findings.md`, `r-enr-01-v40-spec-updates.md`, `eswa-r-enr-01-notice.md`.

---

## Data integrity

### RF-1 · Orphan `schools` row with no `school_profiles`
**Status:** `OPEN` · **Opened:** 2026-05-11 · **Source:** R-ENR-01 Phase 4 migration preview

`schools` has 24 rows; `school_profiles` has 23. One school is missing its profile, so most JOINs through profile return empty — the school is effectively invisible to the dashboard, multi-year engine, advisory, and exports. Likely incomplete cascade delete or onboarding that errored before profile insert.

Diagnostic query: `SELECT id, name, status, organization_id, created_at FROM schools WHERE id NOT IN (SELECT school_id FROM school_profiles)`.

Recommended action: identify the orphan, check `user_roles` for an active owner. If active founder → restore profile from defaults + notify. If abandoned → delete `schools` row.

**Pre-May-19 severity:** Low unless the orphan is an active founder. Triage via the query first.

---

### RF-3 · v4.0 spec/schema mismatch on `advisory_data_hash`
**Status:** `OPEN` · **Opened:** 2026-05-11 · **Source:** R-ENR-01 Phase 4 schema check

v4.0 spec Section 14.1 documents an advisory cache clear pattern referencing `advisory_data_hash`, which is not a column on `school_profiles`. The dataHash lives inside the JSONB at `advisory_cache.dataHash` (per `types.ts:152-165` `AdvisoryCache` interface). Setting `advisory_cache = NULL` clears both atomically.

The related `scenarios.base_data_hash` column does exist (scenario staleness detector) — likely the source of the spec confusion.

**Severity:** Low. Documentation-only; runtime code is correct. Fix in next spec revision.

---

## Verification dependencies

### RF-2 · Scenarios staleness verification post-R-ENR-01
**Status:** `INVESTIGATING` · **Opened:** 2026-05-11 · **Source:** R-ENR-01 Phase 4

Existing `scenarios` rows cache `results`, `ai_analysis`, and `base_data_hash`. The R-ENR-01 engine fix changes the inputs the hash is computed from, so `base_data_hash` will mismatch the recomputed hash on next visit. The Scenarios tab's existing staleness detector should fire and prompt recomputation.

R-ENR-01 deliberately did NOT pre-emptively clear these rows — trusting the staleness mechanism is the system working as designed. Phase 5 verification must explicitly confirm: opening Scenarios for Evergreen Heights post-fix triggers the stale indicator and prompts recompute. If it doesn't, file as a separate finding.

**Pickup signal:** Part 3 audit, Scenarios tab.

---

## Revenue engine — resolved

### R-REV-01 · LAP High Poverty missing 50% FRL gate + SSE double-accounting
**Status:** `RESOLVED` · **Opened:** 2026-04-21 · **Resolved:** 2026-04-21

Two related defects in `calcCommissionRevenue` (`src/lib/calculations.ts`): (1) LAP
High Poverty was computed as a flat `enrollment × rate`, missing OSPI's 50% FRPL
threshold gate and the `(pctFrl / 100)` scaling factor — the UI showed a
constant $17,952 regardless of FRL; and (2) `rev.total` excluded Small School
Enhancement, but one caller (`budgetEngine.ts:533`, `computeMultiYearDetailed`)
added SSE externally while 8 other sites used bare `rev.total` — so sub-threshold
schools silently under-reported revenue everywhere except the multi-year engine,
and Step 2's `totalGrants = rev.total - baseRevenue` could go negative.

**Fix (Option A-wide):** gate LAP HP at 50% FRL and multiply by `pctFrl/100`; add
an optional `sse` param to `calcCommissionRevenue` so `rev.total` is now a true
total; drop the external `+ smallSchoolEnhancement` add at `budgetEngine.ts:533`;
thread SSE through all remaining callers. Regression guardrail: `tests/session4/revenue-integrity.spec.ts` — 4 tests pinning the threshold gate, SSE inclusion in `rev.total`, Step 2/Step 3 cross-consistency, and the constituent-sum invariant.

---

## Session 4 audit — deferred items

These came out of the Session 4 audit and weren't addressed in that
session's scope. Kept here so the next audit pass can pick them up.

### S4-01 · Scenario engine AI analysis retry/backoff coverage
**Status:** `DEFERRED` · **Opened:** 2026-04-21 · **Source:** Session 4 audit 5.5

`src/lib/anthropic.ts` now centralizes Anthropic calls with retry/backoff
(per commit `c500626`). The scenarios AI endpoint uses the centralized
path, but there's no E2E assertion that a 429 on the first attempt
surfaces as a successful retry to the user. Add a minimal network-mock
harness test.

---

### S4-02 · FPF badge Stage 1/Stage 2 tooltip copy review
**Status:** `DEFERRED` · **Opened:** 2026-04-21 · **Source:** Session 4 audit

Tooltips were added in commit `09d0dc7` but copy hasn't been reviewed by
the Commission-facing stakeholder. Non-blocking — current copy is
accurate, just not reviewed.

---

### S4-03 · Custom title tooltip component — a11y regression sweep
**Status:** `DEFERRED` · **Opened:** 2026-04-21 · **Source:** Session 4 audit, commit `f9d90ed`

Native HTML `title` attributes were replaced with a custom `Tooltip`
component for consistent styling. One more pass with an actual screen
reader (VoiceOver / NVDA) to confirm the custom component announces
correctly — no regressions from the native behavior.

---

### S4-04 · Cedar Ridge E2E — Phase 8+ findings
**Status:** `OPEN` · **Opened:** 2026-04-21

Umbrella entry covering everything that came up while hardening
`full-founder-journey.spec.ts` beyond Phase 7:

- **P-UX-01** (Revenue-tab persistence) — primary blocker
- **P-UX-02** (Joyride overlay race) — contributing blocker
- **T-INFRA-03** (helper load-bearing status)

Unskipping Phases 8–14a in the E2E test is gated on **P-UX-01** and
**P-UX-02** both moving to `RESOLVED`.

---
