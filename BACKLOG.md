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
**Status:** `RESOLVED` · **Opened:** 2026-04-21
**Resolved:** 2026-05-12 — Driver badge on the Staffing tab
(`src/app/(authenticated)/dashboard/staffing/page.tsx`) is now a clickable
button toggling between the position's catalog-default per-pupil variant
and `fixed`. When `driver !== 'fixed'`, Y2-Y5 FTE inputs render disabled
with a tooltip pointing the user back at the badge. Toggling fixed →
per-pupil re-runs `computeSmartFte` to re-derive Y2-Y5; toggling per-pupil
→ fixed preserves existing FTE values intact. Engines unaffected —
`driver` is UI-scoped (zero references in `budgetEngine.ts` or
`scenarioEngine.ts`). Tour copy at `data-tour="driver-column"` updated to
mention the click-to-switch affordance.

**Related latent fix bundled:** the multi-year fill `.find` in the
Staffing page's useEffect rebuild (`staffing/page.tsx:366-368`) previously
matched DB rows on `position_type || title` only, so schools with multiple
positions of the same type (e.g., Cascade Charter Elementary's 4
paraeducators all at year=1) collapsed all Y2-Y5 values to the FIRST
matching row. Fixed by adding `ap.sort_order === p.sort_order` to the
match key. Self-heals on next save; no data migration needed.

**Follow-ups logged:** P-UX-07 (status enum display), P-UX-09
(driver-variant catalog drift), P-UX-10 (paraeducator Y1 minimum drift),
T-INFRA-05 (E2E driver toggle coverage).

Each of the 27 Commission-aligned positions has a `driver` column
(enrollment-based, section-based, fixed, etc.) that determines how the
position scales across years in the multi-year projection. The driver was
seeded from `COMMISSION_POSITIONS` in `src/lib/types.ts` and was not
exposed in the Staffing tab UI — founders couldn't override it even when
their school's staffing model intentionally differed (e.g., a dean
position that should scale with sections, not enrollment). Surfaced as a
real user bug when a founder reported Y2/Y3 paraeducator FTE values
reverting to formula output after entry.

**Original proposed fix (superseded by the shipped click-to-override
badge):** surface `driver` as an inline dropdown on the staffing row,
with the default value pre-selected and a warning tooltip when the
founder deviates from the Commission default ("Commission models this
role on enrollment — override only if your staffing plan justifies").

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

### P-UX-07 · Startup funding status dropdown shows raw lowercase enum
**Status:** `OPEN` · **Opened:** 2026-05-12

The status `<select>` on both the Revenue tab editor
(`src/app/(authenticated)/dashboard/revenue/page.tsx:586-593`) and the
onboarding Step 5 startup-funding row
(`src/components/onboarding/StepOperations.tsx:610-617`) renders the raw
lowercase enum values (`received | pledged | applied | projected | n/a`)
as option labels. The two editors were aligned to lowercase as part of the
2026-05-12 startup-funding discoverability fix so they matched, but the
founder-facing display should be Title Case
(`Received | Pledged | Applied | Projected | N/A`) for readability.

**Proposed fix:** add a `FUNDING_STATUS_LABELS` map (raw → Title Case) and
render `<option value={raw}>{LABEL[raw]}</option>` on both surfaces.
Display only — no data migration. Low priority, polish.

---

### P-UX-08 · Settings-as-canonical home for startup funding sources
**Status:** `OPEN` · **Opened:** 2026-05-12

The Revenue tab is the canonical post-onboarding editor for startup
funding sources today
(`src/app/(authenticated)/dashboard/revenue/page.tsx:510-682`). On
2026-05-12 a discoverability fix shipped on top of it: `id="startup-grants"`
anchor added, Cash Flow empty-state replaced with a primary-button `<Link>`,
footer note linkified, helper text added for the Y0 requirement. This
resolved the reported founder bug (couldn't assign funding to pre-opening
expenses because no sources existed). Phase 2 — extract a shared editor
and make Settings the canonical home — was deferred.

**Phase 2 work:**
1. Extract `<StartupFundingEditor>` from the inline Revenue-tab block into
   a reusable component
   (`src/components/dashboard/StartupFundingEditor.tsx`).
2. Add a Settings section "Startup Funding" between Programs and Revenue
   Assumptions, rendering the extracted editor.
3. Add a Cash Flow inline "Manage funding sources" modal wrapping the same
   editor; parent `reload()` refreshes the dependent dropdowns on close.
4. Retire the inline editor on the Revenue tab; leave a deep-link pointer
   ("Manage in Settings → Startup Funding").

**Deferred because:** the discoverability fix already resolves the reported
founder bug. Settings-as-canonical is structural cleanup, not a
user-blocking issue. Medium priority, post-RFP.

---

### P-UX-09 · Dead driver-variant catalog drift in `COMMISSION_POSITIONS`
**Status:** `OPEN` · **Opened:** 2026-05-12 · **Source:** P-UX-03 follow-up

`COMMISSION_POSITIONS` (`src/lib/types.ts:241-273`) encodes four per-pupil
driver variants — `per_pupil_elem`, `per_pupil_ms`, `per_pupil_hs`,
`per_pupil_sped` — that are dead. The Staffing page's `POSITION_DRIVER`
map (`src/app/(authenticated)/dashboard/staffing/page.tsx:66-100`)
collapses all three teacher types to plain `per_pupil`, and the SPED
teacher to `fixed`. `computeSmartFte` does not branch on the variants.
`DRIVER_LABELS` (staffing/page.tsx:199-204) exposes only `fixed`,
`per_pupil`, `per_pupil_sped`, and `per_pupil_el`.

**Decision needed:** either
(a) Prune the dead variants from `COMMISSION_POSITIONS` to match the
    UI-canonical mapping (cleanup, lower-risk), or
(b) Wire the variants through `computeSmartFte` so elem/ms/hs/sped
    scale differently (new feature; requires defining the scaling math
    and updating the seed route).

**Why it matters:** the drift becomes user-visible the moment driver
becomes a `<select>` with all variants exposed (the "full" P-UX-03
follow-up Option C). Until then it's a maintenance-only smell. Medium
priority — decision required before any expanded driver-editor work.

---

### P-UX-10 · Y1 paraeducator FTE minimum drift between seed and dashboard
**Status:** `OPEN` · **Opened:** 2026-05-12 · **Source:** P-UX-03 follow-up

The staffing seed route (`src/app/api/staffing/seed/route.ts:42-51`)
enforces a Y1 paraeducator FTE minimum:
`Math.max(2, round(enrollment / 48 * 2) / 2)`. The staffing-page formula
`computeSmartFte`
(`src/app/(authenticated)/dashboard/staffing/page.tsx:213-250`) does not.

**Effect:** a paraeducator seeded at Y1=2 stays there as long as the user
never touches the cell. But any user interaction that re-runs
`computeSmartFte` — type-dropdown change, toggle to fixed and back
(P-UX-03 fix path), or a useEffect rebuild — can derive a Y1 value below
2 if Y1 enrollment is small.

**Proposed fix:** align `computeSmartFte`'s paraeducator branch to apply
the same `Math.max(2, …)` floor that the seed uses. One-line change at
line ~244. Low priority, consistency cleanup.

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

### T-INFRA-05 · Update `full-founder-journey` E2E to exercise the new driver toggle
**Status:** `OPEN` · **Opened:** 2026-05-12 · **Source:** P-UX-03 follow-up

The driver-flip step at
`tests/session4/e2e/full-founder-journey.spec.ts:547-567` looks for a
`<select>` element to change driver. It never found one (driver was
read-only) and gracefully `infoFlag`s, providing false reassurance. As of
2026-05-12 (P-UX-03 resolution) driver is now a `<button>` on the Staffing
tab — the test still finds no `<select>` and still `infoFlag`s, but the
underlying gap (no driver-flip coverage) is now real test debt.

**Proposed fix:** update the test to locate the new button (approximately
`button[title^="Click to switch"]`), click it, verify the badge label
flips and a Y2-Y5 FTE input's `disabled` attribute toggles accordingly.
Remove the comment block at lines 563-566 that referenced the old
read-only `<span>`. Low priority, test debt.

---

## R-ENR-01 — Enrollment retention modeling paired fix (RESOLVED)

**Resolved:** 2026-05-11

**Summary:** Two compounded bugs in the enrollment model. F1 (UI) was a hardcoded `const retentionRate = 100` in `GradeExpansionEditor.tsx:64` plus a useEffect that pushed 100 back to parent on every render, overwriting any DB value. F2 (engine) was `computeExpansionEnrollments` at `gradeExpansion.ts:180-205` accepting a `retentionRate` parameter but never referencing it in the function body — same pattern at `expansionToEnrollmentArray:227-245`. F3 surfaced during fix: AI context strings at `buildSchoolContext.ts:213, 377` narrated attrition handling that the engine wasn't doing, causing advisory agents to hallucinate against a model that didn't exist.

**Fix:** Engine now applies retention to continuing-grade students using whole-year compounding (Formula A). New-grade students enroll at full planned capacity. UI converted from hardcoded const to useState. Settings → Grade Expansion slider added (range 70-100, step 1, default 92%). Onboarding Step 2 also exposes the slider. F3 prose rewritten to accurately describe Formula A behavior including buildout-decline disclaimer for Y5 < Y4 case.

**DB migration:** 16 planning-status schools at retention_rate=100 backfilled to 92. advisory_cache and dataHash cleared for all 12 schools that had cache. Migration recorded as `supabase/migrations/20260511220000_r_enr_01_backfill_retention_default.sql`.

**Tests:** 18 invariant tests in `tests/session4/grade-expansion.spec.ts` covering retention=90, 92, 100 trajectories plus boundary cases.

**Related findings** logged during R-ENR-01 work:
- **RF-1 (orphan school):** 24 schools in `schools` table, 23 with `school_profiles` rows. One school is missing its profile, joins through profile data fail for it. Diagnostic: `SELECT id, name, status, created_at FROM schools WHERE id NOT IN (SELECT school_id FROM school_profiles)`. Recommended action: identify and either fully delete (cascade) or restore profile row.
- **RF-2 (scenarios staleness verification):** Engine output changed; cached scenarios `results` and `ai_analysis` may be stale. Existing staleness detector should fire on next user visit (base_data_hash mismatch). Verify on a school with stored scenarios.
- **RF-3 (spec/schema mismatch):** v4.0 spec Section 14.1 references "Advisory cache clear: UPDATE school_profiles SET advisory_cache = NULL, advisory_data_hash = NULL" but `advisory_data_hash` is not a column. The hash lives inside `advisory_cache.dataHash` JSONB property. Setting `advisory_cache = NULL` atomically clears the hash. Doc fix for next spec revision.
- **RF-4 (banner deferred):** In-app banner for authorized/exported schools deferred — zero current targets in production. Per-user-per-school dismissal requires a new column or table (e.g., `dismissed_notices` table with school_id + user_id + notice_id + dismissed_at) with RLS policy scoped to the user, plus a dismissal endpoint and component integration. Build when first school transitions to `authorized` status.

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
