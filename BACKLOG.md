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

### P-UX-11 · Dashboard crashes when `startup_funding` JSON has unexpected shape
**Status:** `OPEN` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

Populating `school_profiles.startup_funding` via direct DB insert with shape
`[{id, name, amount, type, status, year_allocations: {y0..y4}}]` causes the
dashboard Overview to crash with:

```
TypeError: Cannot read properties of undefined (reading 'localeCompare')
  at canonicalizeProjectionInputs
  at computeAdvisoryHash
  at DashboardPage.useMemo[currentDataHash]
```

The error boundary catches it but the entire dashboard is unrenderable until
the column is reverted to `[]`. The user UI (Revenue tab Startup Funding editor)
writes a canonical shape and is presumably safe; this only surfaces for code
paths that build `startup_funding` JSON outside the editor — direct DB seeding,
future import features, backfill migrations, manual Supabase MCP edits during
support work.

**Root cause hypothesis:** `canonicalizeProjectionInputs` sorts startup_funding
items by a string field that doesn't exist on all valid JSON shapes the schema
accepts. The sort comparator calls `localeCompare` on `undefined`.

**Proposed fix (pick one, probably 1 + 3):**
1. Harden the sort comparator: guard `localeCompare` with `?? ''` or
   `String(x ?? '')`. Cheap, defensive.
2. Add a JSON schema validator on the column with a CHECK constraint.
3. Document the canonical shape in a TS type and add a runtime guard in
   `canonicalizeProjectionInputs` that throws a recognizable error if the
   shape is wrong, rather than crashing the dashboard render.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §10.C

---

### P-UX-12 · Staffing tab inline title edit doesn't persist
**Status:** `OPEN` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

On the dashboard Staffing tab, editing a position's title text via the inline
input does not save to the database. Salary and FTE numeric inputs on the same
row do save correctly. Combined with onboarding's grade-agnostic position
seeding (P-UX-13), this means founders can't rename a wrong-grade-band default
position — they have to delete the row and re-create it.

**Reproduction:**
1. Go to Staffing tab
2. Type a new title into the title input of any position row
3. Click Save Changes
4. Refresh — title reverts to original; salary/FTE changes from the same Save
   are persisted

**Proposed fix:** the title input is likely not wired into the row's dirty-state
or update mutation. Check whether the field is included in the patch payload
sent to Supabase. Probably a single line fix in the row form handler.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §10.B and §6

---

### P-UX-13 · Onboarding Staffing step seeds 6 generic positions regardless of grade configuration
**Status:** `OPEN` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

Onboarding's Staffing step seeds 6 default positions (CEO, Principal, Classroom
Teacher Elementary @ 10 FTE, SPED Teacher, Admin Assistant, Paraeducators @ 4 FTE)
regardless of which grades the school will serve or how many sections it plans.

Particularly problematic: "Classroom Teacher - Elementary @ 10 FTE" is seeded
for a 6-12 school that has no elementary grades. The user must delete the
default and re-add the correct teacher types. Combined with P-UX-12 (title
edits don't persist), users can't even rename the wrong-grade-band default.

**Risk:**
- Inflated personnel cost projections during onboarding from irrelevant default
  positions
- Users may not realize they need to delete defaults and end up with wrong
  personnel numbers downstream

**Proposed fix (pick one):**
1. Make seeded positions grade-aware: don't seed elementary teachers if no
   K-5 grades exist; seed HS teachers only when 9-12 grades exist.
2. Skip default seeding entirely; show an empty staffing table with "+Add
   Position" prominent.
3. Show a position-type picker during onboarding: "Which of these roles will
   you have in Year 1?" with checkboxes pre-populated based on grade
   configuration.

Recommend (3) — teaches the user the position taxonomy while letting them
opt in.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §10.E

---

### P-UX-14 · Onboarding completion blanks for ~5 seconds without spinner
**Status:** `OPEN` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

After clicking "Complete Onboarding", the screen goes blank with no visible
spinner or progress indicator for several seconds before redirecting to
`/dashboard`. The completion handler does substantial server-side work
(seeding budget projections, generating initial advisory cache, etc.), so the
delay is real — it just has no UI affordance.

**Risk:** user assumes the click failed, refreshes the page, potentially
triggering duplicate state writes or creating a confusing partial-completion
state.

**Proposed fix:** add a loading state to the Complete Onboarding button:
1. Inline spinner + disabled button until the redirect fires, or
2. Full-screen loading interstitial with "Setting up your school…" copy.

Recommend (2) — the user benefits from knowing substantial setup is happening.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §10.F

---

### P-UX-15 · Default retention rate of 92% diverges from Commission V11's implicit 100%
**Status:** `OPEN` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

SchoolLaunch defaults `retention_rate` to 92% (set by R-ENR-01 fix on
2026-05-11). The Commission's V11 Long-Range Projection template has no
retention input — it implicitly assumes 100% retention (Y2 enrollment = Y2
target grade-buildout fill, no cohort attrition).

Result: a school using SchoolLaunch defaults will project lower Y2-Y5
enrollment than the same school's V11 model produces. For Cedar Grove:
- 92% retention: Y2 ~459, Y3 ~628, Y4 ~660, Y5 ~600 (approximation)
- 100% retention: Y2 480, Y3 690, Y4 780, Y5 780 (matches V11)

SchoolLaunch's 92% default is **more conservative and probably more honest**
than V11's implicit 100% — real charter schools experience attrition — but
the divergence means applicants comparing the two models see different
enrollment trajectories without understanding why.

**Proposed fix (pick one):**
1. Keep 92% default; add Settings copy noting that V11 / many authorizer
   templates implicitly assume 100%; let users adjust if they need to match.
2. Add a "Run as Stress Test" view: model at 100% by default for headline
   metrics, separately show "Stress test at X% retention" view.
3. Change default to 100% to match V11; force users to opt into attrition
   modeling.

Recommend (1) — don't downgrade the more-conservative default to match a
less-conservative template. Documentation is the right fix.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §8

---

### P-UX-16 · Diagnose projSlice for the same canonicalizer brittleness P-UX-11 fixed
**Status:** `OPEN` · **Opened:** 2026-06-03 · **Source:** P-UX-11

P-UX-11 hardened the fundingSlice pipeline in `canonicalizeProjectionInputs`
(`src/lib/buildSchoolContext.ts`) against non-canonical startup_funding shapes.
The sibling projSlice (same function, lines ~60-73) has a latent version of the
same bug: it sorts on `a.cat.localeCompare(b.cat)` / `a.sub.localeCompare(b.sub)`
where `cat: r.category` and `sub: r.subcategory` carry NO `?? ''` default (unlike
posSlice / gepSlice, which default their sort keys). A budget_projections row
with a missing/null category or subcategory would throw the same TypeError and
crash the same dashboard surfaces (Overview, Advisory, Scenarios).

Not fixed under P-UX-11 by decision: scope was held to the diagnosed
startup_funding vector, and projSlice uses a COMPOUND sort key
(`y -> rev -> cat -> sub`), not fundingSlice's single-key string sort, so the
P-UX-11 `coerceSource` helper does not transfer as a provably byte-identical
shared guard. budget_projections is editor/DB-controlled (category/subcategory
effectively always present today), so the risk is currently low.

**Proposed next step:** diagnose whether any seeding/import path (e.g. the
R-REV-03 OSPI line-item work) can write projection rows without category /
subcategory. If so, harden cat/sub with the same `?? ''` pattern posSlice/gepSlice
already use (a pure superset, byte-identical for valid input). Confirm against the
advisory-hash byte-identical guard before shipping.

**Reference:** `tests/audit/v11-cedar-grove/P-UX-11-diagnosis.md` §D3

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

## Revenue engine

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

### R-REV-02 · Investigate possible LAP / LAP High Poverty double-counting for new applicants
**Status:** `RESOLVED` · **Opened:** 2026-05-22 · **Resolved:** 2026-06-03 · **Source:** V11 Cedar Grove validation, Session 1

Cedar Grove at 60% FRL × 240 students produces in SchoolLaunch:
- LAP base: `240 × 0.60 × $816` = $117,504
- LAP High Poverty: `240 × 0.60 × $374` = $53,856 (gated on FRL ≥ 50%, added in R-REV-01)
- **Combined: $171,360**

V11's Cedar Grove model has a single LAP line at $370/total-pupil × 240 = $88,800.
Roughly half of SchoolLaunch's combined output.

**What OSPI confirms:** LAP base and LAP High Poverty are two real, separate
allocations per OSPI's LAP Guide 2025 and RCW 28A.165.005. Schools with a
3-year rolling FRPL average ≥ 50% qualify for the High Poverty supplement on
top of the base allocation. Cedar Grove at 60% FRL would qualify — if it had
3 years of FRPL history.

**Two possible reasons for the V11 vs. SchoolLaunch gap:**
1. V11 omits LAP High Poverty for **new applicants** because they don't have
   a 3-year FRPL history yet (the rolling average is backward-looking).
2. V11 conflates the two allocations into one line to simplify presentation.

**Action:** confirm whether SchoolLaunch's LAP High Poverty line should be gated
not just on `FRL ≥ 50%` but also on **whether the school has 3 years of FRPL
history**. New applicant schools should likely show LAP High Poverty = $0 in
Years 1–3 and only begin populating in Year 4. Needs WSCSC interpretation: does
the Commission expect new applicants to project LAP High Poverty as $0 or to
project it at the FRL%-implied rate?

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §5.C, OSPI LAP
Guide 2025, RCW 28A.165.005

**Resolution (2026-06-03):** Option A + (i). Gated the LAP High Poverty
**supplement** in `calcCommissionRevenue` (`src/lib/calculations.ts`) behind a
new optional `hasFrplHistory: boolean = false` parameter; the supplement is now
$0 across the full Y1-Y5 horizon for new applicants (matching V11 / the
Commission template), while the LAP **base** line is untouched. No schema change
- the WA Charter pathway is a pre-opening planning tool, so every school is a
new applicant by definition and there is no FRPL-history column to gate on. The
Generic pathway is unaffected (it has no LAP High Poverty line). Diagnosis:
`tests/audit/v11-cedar-grove/R-REV-02-diagnosis.md`. Regression coverage added
to `tests/session4/revenue-integrity.spec.ts` (new-applicant $0 path, Cedar
Grove pin, and the prior scaling-formula assertions retained via
`hasFrplHistory: true`). The Y4 ramp (Option ii) was deliberately not taken;
it remains open pending WSCSC interpretation.

---

### R-REV-03 · Add missing OSPI revenue line types to WA Charter pathway
**Status:** `OPEN` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

Confirmed missing from SchoolLaunch's WA Charter revenue model, all present in V11:

| OSPI account | Line | Notes |
|---|---|---|
| Title II | Federal Title II | ~$36/pupil, supports teacher quality |
| Title III | Federal Title III | ~$23/pupil, English Language Acquisition |
| 4198 | State Food Service | $23/pupil, separate from federal 6198 |
| 4199 | Transportation Operations | $595/pupil, currently modeled only as expense |
| 6100 | OSPI Special Purpose Unassigned | Catch-all for additional OSPI grants |
| 2200 | Sale of Goods/Supplies/Services | Small but expected |
| 3121 (semantic) | SPED General Apportionment | May be conflated with 4121 State SPED in current SPED-per-pupil field — verify and split if needed |

**Proposed fix (split approach):**

(a) **For the long tail** (Title II/III, 6100, 2200, 4198): add a "Custom Revenue
    Lines" UI that surfaces `school_profiles.custom_revenue_lines` (JSONB
    column already exists in schema, currently unused). Users add
    OSPI-account-coded lines with name + per-pupil rate + driver + recurring
    flag. The Revenue page renders these alongside first-class lines.
    Faster, flexible, doesn't require schema work each time OSPI adds a
    categorical.

(b) **For the load-bearing ones**: add 4199 Transportation Operations as a
    first-class line since it has a matching expense (already modeled), and
    split 3121/4121 SPED since SPED math touches many places. These need
    direct engine integration.

**Blocker resolution:** once this lands, the V11 Cedar Grove reconciliation
can close ~$25K–$200K of the Y1 revenue gap depending on which lines are added.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §4, V11 INPUTS R41-R76

---

### R-REV-04 · CSP semantic decision: recurring operating vs. non-recurring startup
**Status:** `OPEN` (requires product decision) · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

The federal Charter Schools Program (CSP) grant is modeled differently in
SchoolLaunch vs. V11:

- **SchoolLaunch:** CSP appears in "Startup & Other Grants — Funding Sources",
  modeled as one-time startup funding. **Excluded from sustainability metrics**
  (Total Margin, DCOH calculations that drive FPF scorecard).
- **V11 (Cedar Grove):** CSP is a recurring operating revenue line at
  $400,000/year for Y2-Y5 ($1.6M cumulative). **Included in Total Revenue**
  for FPF scorecard purposes.

**Why this matters:** for a 5-year projection, CSP at $400K/year on a $5-16M
revenue base affects Total Margin by 2-8 percentage points and DCOH by 30-90
days. The same school will pass or fail FPF Stage 1/2 thresholds depending on
which model is applied. CSP is a multi-year federal grant — defensible to
model either way. WSCSC's actual interpretation determines which one is right
for charter application financial plans.

**Proposed fix (pick one):**
1. Move CSP to recurring operating revenue (match V11).
2. Keep CSP as startup funding but expose a toggle: "Include CSP in operating
   revenue for FPF calculations: Yes / No". Default ON for WA Charter pathway
   since V11 (the Commission's template) treats it as recurring.
3. Leave current behavior, document in spec, let users override on Revenue page.

Recommend (2) — gives users control without forcing a default that may not
match their authorizer's interpretation.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §4 (CSP row)

---

### R-REV-05 · Default WA Charter salary benchmarks are 25-40% below V11/OSPI/BLS levels
**Status:** `OPEN` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

Comparing SchoolLaunch's default WA Charter salaries against V11's preloaded
OSPI/BLS benchmarks (V11 STAFFING Section 2):

| Position | SchoolLaunch default | V11 default | Cedar Grove used | Diff |
|---|---:|---:|---:|---:|
| CEO/Executive Director | $120,000 | $200,000 | $206,000 | -40% |
| Principal/Head of School | $95,000 | $130,000 | $133,900 | -27% |
| SPED Teacher | $62,000 | $85,000 | $85,000 | -27% |
| Administrative Asst | $52,000 | (V11 blank) | $68,000 | -24% |
| Paraeducator | $38,000 | $40,000 | $40,000 | -5% |

**Risk:** a WA charter applicant onboarding with SchoolLaunch's defaults and
not overriding them will submit a financial plan with personnel costs
systematically below market. Two failure modes: (1) the Commission rejects the
projection as unrealistic, (2) the school authorizes on an unrealistic budget
and can't actually hire to plan, triggering Y1 over-spend findings.

**Proposed fix:**
1. Update default WA Charter salaries to match V11/OSPI/BLS benchmarks.
2. Add a tooltip or info icon next to each salary input noting the source:
   "Default from BLS WA / OSPI S-275 — verify against your local market".
3. Bonus consideration: regionalize salary defaults (Spokane vs. Seattle vs.
   Yakima market differences are large). May be Phase 2.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §6 salary
defaults table

---

### R-REV-06 · Authorizer fee base may not include all state revenue
**Status:** `INVESTIGATING` · **Opened:** 2026-05-22 · **Source:** V11 Cedar Grove validation, Session 1

SchoolLaunch shows Y1 authorizer fee at $102,005 for Cedar Grove. V11 documents
the fee base as "3% of State Revenue" and Cedar Grove's V11 Y1 fee is $100,974.
Close ($1,031 difference, ~1%) but not identical. The discrepancy may be from:

- Different definition of "state revenue" (BEA only vs. BEA + state categoricals)
- SchoolLaunch applying the 3% before/after regionalization multiplier
- Inclusion or exclusion of SSE in the base

Cedar Grove's V11 fee base appears to be: BEA + 3121 SPED + 4121 State SPED +
LAP + TBIP + HiCap + 4198 State Food Service + 4199 Transportation. SSE
included. Current SchoolLaunch spec (§9.7) says authorizer fee base includes
SSE as "working assumption pending charter contract verification" — this needs
verification against a real charter contract or WSCSC publication.

**Action:**
1. Determine SchoolLaunch's current authorizer fee calculation: which revenue
   lines are in the base, in what order with regionalization.
2. Compare against V11's apparent inclusions.
3. Verify against the WSCSC's actual contract language (Travis has access via
   the charter community).
4. Update spec §9.7 to remove "working assumption" language once verified.

**Reference:** `tests/audit/v11-cedar-grove/SESSION_1_GAPS.md` §5.B, V11 INPUTS R122,
SchoolLaunch Product Spec v4.0 §9.7

---

### R-REV-08 · Settings grant-preview computes LAP High Poverty independently and divergently
**Status:** `OPEN` · **Opened:** 2026-06-03 · **Source:** R-REV-02 diagnosis (D1)

The Settings page renders a "grant preview" that recomputes LAP High Poverty
inline instead of calling `calcCommissionRevenue`:

```
// src/app/(authenticated)/dashboard/settings/page.tsx:113
lapHighPoverty: Math.round(enrollY1 * (fa.lap_high_poverty_per_pupil || 374)),
```

This parallel computation diverges from the canonical line in two ways and was
already wrong **before** R-REV-02: it has **no 50% FRL threshold gate** and
**no `pctFrl/100` scaling** (flat `enrollment x rate`). After R-REV-02 it also
fails to reflect the new-applicant `hasFrplHistory` gate, so the Settings
preview will show a non-zero LAP High Poverty figure where every projection
surface now correctly shows $0. It is a rate-illustration widget, not a
projection, so impact is cosmetic/advisory only - but it violates the
single-source-of-truth principle and will confuse founders comparing Settings
against Revenue / Multi-Year.

**Proposed fix:** drive the Settings preview from `calcCommissionRevenue`
(or `calcAllGrants` once that dead helper is either removed or aligned) so all
grant figures share one computation. Out of scope for R-REV-02 (no-driveby);
logged here for a future Revenue-engine consolidation pass. Note: `calcAllGrants`
(`src/lib/calculations.ts:82`) is dead code carrying its own duplicate HP gate
and should be removed or aligned in the same pass.

**Reference:** `tests/audit/v11-cedar-grove/R-REV-02-diagnosis.md` §D1

---

### R-REV-09 · Dead parallel WA Charter salary catalog in stateConfig.ts
**Status:** `OPEN` · **Opened:** 2026-06-03 · **Source:** R-REV-05

After the R-REV-05 consolidation, `WA_CHARTER_POSITIONS` in `src/lib/stateConfig.ts`
is a dead parallel 27-position salary catalog. Its comment claims "Exact match to
COMMISSION_POSITIONS in types.ts", but it is NOT consumed by WA Charter onboarding:
`StepStaffing.getDefaults()` routes the `wa_charter` pathway to
`buildDefaultPositions` (which now reads salaries from `COMMISSION_POSITIONS` via
`waSeedSalary`), and only non-WA pathways call `buildDefaultPositionsFromConfig`,
which is the only reader of stateConfig position salaries. So `WA_CHARTER_POSITIONS`
carries `default_salary` numbers that nothing in the WA path uses, and which can
silently drift from the single source of truth.

**Proposed fix:** either delete `WA_CHARTER_POSITIONS` (if no WA path needs a
stateConfig-shaped position list) or derive it from `COMMISSION_POSITIONS` so there
is exactly one place salaries live. Confirm no remaining reader before deleting.

**Sub-note:** `tests/session4/revenue-classification.spec.ts:75-80` carries stale
inline salary literals (the old below-market onboarding defaults: 120000 / 95000 /
58000 / 62000 / 52000 / 38000). They do not break the test (inline fixture data,
not catalog reads) but should be refreshed to the current benchmark values in the
same pass for realism.

**Reference:** `tests/audit/v11-cedar-grove/R-REV-05-diagnosis.md` §D1

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
