# P-UX-16 — Phase 0 Diagnosis: advisory `projSlice` shape-defense

**Date:** 2026-06-04 · **Scope:** advisory-path shape-defense (no engine change) · **Status:** Phase 0, HARD STOP pending approval
**Diagnosed by reading:** `src/lib/buildSchoolContext.ts`, `src/lib/startupFunding.ts`, `src/lib/preOpening.ts`, `src/lib/engineVersion.ts`, `src/lib/budgetEngine.ts`, `src/lib/types.ts`, `tests/session4/startup-funding-engine-canonicalizer.spec.ts`, live Supabase (`nlvlrznhiwuorxlapnej`), BACKLOG.md §P-UX-16 / §P-UX-11.

---

## Premise reconciliation (corrections to the task brief)

The brief described `projSlice` as reading "raw projection/**pre-opening** data." **The pre-opening half is wrong** and I am correcting it up front:

- `projSlice` reads **only** `projections: BudgetProjection[]` (the `budget_projections` rows). It does **not** touch `pre_opening_transactions` / `pre_opening_expenses` / `startup_funding`.
- Pre-opening shapes are defended at the **engine** boundary inside `computeCarryForward` (P-UX-19), which is a *different* reader on a *different* code path. `projSlice` never reaches them.
- So the accurate statement of P-UX-16: `projSlice` is the **`budget_projections` projection of the advisory hash**, and it is the one slice in `canonicalizeProjectionInputs` that was never given a shape-defense.

The brief's core threat model is otherwise correct: malformed entries arrive via **DB seed / import / backfill / CSP fixtures**, never the in-app editor (confirmed in §4 below).

---

## 1. Where `projSlice` lives and how it is undefended

- **File / function:** `src/lib/buildSchoolContext.ts` → `canonicalizeProjectionInputs(input)`, **lines 80–93**.
- **Only reader:** `projSlice` is a function-local `const`, consumed solely by the `JSON.stringify({ ..., projections: projSlice, ... })` at line 148. It has exactly one downstream surface: `computeAdvisoryHash` (line 174) — which backs both `school_profiles.advisory_cache.dataHash` **and** `scenarios.base_data_hash` (via the `hashProjectionInputs` alias, line 180).
- **Current code (verbatim):**

```ts
const projSlice = projections
  .map(r => ({
    y: r.year,
    cat: r.category,
    sub: r.subcategory,
    rev: r.is_revenue ? 1 : 0,
    amt: Math.round(r.amount ?? 0),
  }))
  .sort((a, b) =>
    a.y - b.y
    || (a.rev - b.rev)
    || a.cat.localeCompare(b.cat)
    || a.sub.localeCompare(b.sub)
  )
```

**How it differs from the already-defended `fundingSlice` (lines 111–122):** `fundingSlice` opens with `canonicalizeStartupFunding(profile.startup_funding)` (P-UX-18) before `.map`/`.sort`, so every entry is guaranteed a non-null object with coerced fields. `projSlice` maps over **raw `projections` directly** — no canonicalizer, no per-field guard. The sibling slices in the same function are only *partially* defended: `posSlice` and `gepSlice` default their **sort keys** with `?? ''` (e.g. `pt: p.position_type ?? ''`, sort on `a.gl.localeCompare`… though `gepSlice.gl` is itself undefaulted — a latent cousin), but `projSlice` defaults **neither** of its string sort keys (`cat`, `sub`).

**Confirmed genuinely undefended:** grep of `src/**/*.ts` for `canonicalize` returns only `buildSchoolContext.ts`, `budgetEngine.ts`, `preOpening.ts`, `startupFunding.ts`. **No canonicalizer exists for the `BudgetProjection` shape.**

---

## 2. What it reads raw + precise failure reproduction

Shape consumed (`src/lib/types.ts:211`):

```ts
export interface BudgetProjection {
  id?: string; school_id: string; year: number; category: string;
  subcategory: string; amount: number; is_revenue: boolean;
  notes?: string; updated_at?: string;
}
```

Three distinct failure modes, in order of severity:

**Mode 1 — null / non-object array element (THROWS).**
A `null` (or string/number) element in `projections` hits `.map(r => ({ y: r.year, ... }))`:
`r.year` on `null` →
> `TypeError: Cannot read properties of null (reading 'year')` — **buildSchoolContext.ts:82**.
Same class as the P-UX-18/19 null-entry crashes. Crashes `computeAdvisoryHash` → breaks advisory generation, scenario staleness check, Overview, Advisory Panel, Scenarios.

**Mode 2 — missing / null `category` or `subcategory` (THROWS), the BACKLOG-documented vector.**
A well-formed object with `category: null` survives `.map` (`cat: null`), then in `.sort`:
`a.cat.localeCompare(b.cat)` on `cat === null` →
> `TypeError: Cannot read properties of null (reading 'localeCompare')` — **buildSchoolContext.ts:91** (`sub` → **:92**).
This is exactly the brittleness BACKLOG §P-UX-16 flagged (no `?? ''` on `cat`/`sub`).

**Mode 3 — non-finite `amount` (SILENT HASH CORRUPTION — the more dangerous case).**
`amt: Math.round(r.amount ?? 0)` — `??` only catches `null`/`undefined`. A non-numeric/`NaN`/`Infinity` amount slips through:
- `amount: 'abc'` → `Math.round(NaN)` = **`NaN`**
- `amount: NaN` → `NaN`; `amount: Infinity` → `Infinity`

`NaN`/`Infinity` are serialized by `JSON.stringify` as **`null`** (line 148). No throw, no warning — the canonical string silently changes shape **and length**, so:
- the `djb2` segment changes **and**
- the `|len` discriminator changes,

→ **the advisory hash silently diverges**, spuriously invalidating the cache (and now, post-P-UX-21, cache invalidation is *meaningful*, so this is a real correctness hazard, not cosmetic). Quoted culprit:
> `amt: Math.round(r.amount ?? 0),` — **buildSchoolContext.ts:86**

---

## 3. Reuse vs. new — recommendation: **NEW value-preserving canonicalizer**

- **Reuse is not available.** `canonicalizeStartupFunding` defends `StartupFundingSource`; `canonicalizePreOpening{Transactions,Expenses}` defend `PreOpeningTransaction`/`PreOpeningExpense`. `projSlice` reads `BudgetProjection` — a **genuinely distinct shape** none of those cover. Routing `BudgetProjection[]` through a funding/pre-opening canonicalizer would be wrong-shaped, not reuse.
- **Therefore define one new canonicalizer**, mirroring the established sibling pattern: non-array → `[]`; drop null/non-object entries; preserve well-formed entries exactly; idempotent; **strict no-op on canonical input**.

**Semantics decision — COERCE (mirror P-UX-18), not DROP (P-UX-19) — recommended, justification:**
`projSlice` today **keeps every row** and already *coerces* (`is_revenue ? 1 : 0`, `amount ?? 0`). It never drops rows. To stay a true shape-defense (and byte-identical on canonical input) the canonicalizer should:
- **drop only entries that cannot be projected at all** (null / non-object — Mode 1), and
- **coerce the problematic fields** on surviving objects: `category`/`subcategory` → string (null/undefined → `''`, matching the `posSlice`/`gepSlice` `?? ''` house pattern), `amount` → finite number (`Number()`, non-finite → `0`).

P-UX-19's *drop-the-whole-entry-on-bad-numeric* is wrong here: dropping a row with valid `cat`/`sub` but a bad `amount` would remove it from the hash, changing `projSlice`'s long-standing "one entry per row" behavior — that exceeds shape-defense and is not byte-identical-in-spirit. Coercion keeps row count stable and is a strict no-op on canonical data.

**Proposed shape (for approval — not yet written):**
- New module `src/lib/budgetProjections.ts`, export `canonicalizeBudgetProjections(raw: unknown): BudgetProjection[]`, sibling to `startupFunding.ts` / `preOpening.ts`.
- Optional helper reuse: `coerceSource` (already exported from `startupFunding.ts`) is a generic "unknown → stable string (null → '')" and fits `category`/`subcategory`; reusing it avoids a duplicate string-coercer. (Open to a self-contained local helper instead — flagged for your call.)
- `projSlice` line 80 becomes `canonicalizeBudgetProjections(projections).map(...).sort(...)`, exactly as `fundingSlice` layers on `canonicalizeStartupFunding`. After canonicalization, `cat`/`sub` are always strings (Mode 2 fixed), `amt` always finite (Mode 3 fixed), and null elements are gone (Mode 1 fixed).

**Critical placement note:** the new module must **NOT** be added to `ENGINE_HASH_FILES` (buildSchoolContext.ts:25). That list feeds `ENGINE_VERSION`; adding a file would bump the engine token and invalidate every cache — the opposite of the goal. This is an advisory-only consumer, so `ENGINE_VERSION` stays `53ec6cd11605` and **no cache invalidates**.

---

## 4. Hash baseline (the byte-identical pins Phase 2 must hold)

Current tokens: `PROMPT_VERSION = 'v3-2026-05'`, `ENGINE_VERSION = '53ec6cd11605'` (engineVersion.ts:4). Hash shape = `PROMPT_VERSION|ENGINE_VERSION|djb2|len`.

Captured by **running the existing P-UX-18 spec just now (8/8 passed, 3.3s)** — its fixtures route a canonical `budget_projections` row through `projSlice`, so these ARE the canonical projSlice pins:

| Fixture (canonical) | Full 4-segment advisory hash |
|---|---|
| **WA** (Benton Cnty, CSP $350k, `[{year:1, Operations/Facilities, $120000, is_revenue:false}]`) | `v3-2026-05\|53ec6cd11605\|ff272d0d\|1599` |
| **Generic** (Founder Donation $120k, same projection row) | `v3-2026-05\|53ec6cd11605\|85dcf73f\|1561` |

**Phase 2 assertion:** after the fix, `computeAdvisoryHash` on these canonical fixtures must still end with `|ff272d0d|1599` and `|85dcf73f|1561` respectively (the existing P-UX-18 spec already asserts this via `.endsWith(...)`, so it doubles as the regression guard). A strict-no-op canonicalizer keeps both green automatically.

**Live cross-check (Supabase):** test-columbia = *Columbia Valley Charter School* (`64b84ff8-2824-4ca4-9814-57fa39b23c26`), **24 projection rows, 0 null `category`, 0 null `subcategory`**. `advisory_cache.dataHash` is currently `null` (cache cleared during P-UX-20, S597) — which is *why* a deterministic fixture, not live DB data, is the correct reproducible baseline (live data can drift between Phase 0 and Phase 2; the P-UX-18/19 specs use fixtures for exactly this reason). The zero-null counts confirm the editor never produces malformed rows → threat is non-editor only.

---

## 5. Blast radius

- **Advisory-path only.** Touch is confined to `projSlice`'s input inside `canonicalizeProjectionInputs`. No engine function (`computeMultiYearDetailed`, `calcCommissionRevenue`, `calcAllGrants`, `computeFPFScorecard`, `computeCarryForward`, `computeGenericProjections`) is read or modified. No change to any advisory *output logic* — only the shape of the slice **input**.
- **WA / Generic uniform.** `canonicalizeProjectionInputs` is region-agnostic; both pathways hit identical code. Both pins in §4 are guarded.
- **Single reader.** `projSlice` is function-local; no other importer. `computeAdvisoryHash` is the sole public surface, and its 4-segment contract is unchanged.
- **`ENGINE_VERSION` unchanged** (new module excluded from `ENGINE_HASH_FILES`) → no cache invalidation cascade.

---

## 6. Recommended fix + test file

**Fix (pending approval):**
1. New `src/lib/budgetProjections.ts` → `canonicalizeBudgetProjections(raw)`: non-array → `[]`; drop null/non-object entries; coerce `category`/`subcategory` → string (null → `''`), `amount` → finite (non-finite → `0`); keep `year`/`is_revenue` as-is; value-preserving + idempotent.
2. `buildSchoolContext.ts:80` — wrap `projections` in `canonicalizeBudgetProjections(...)` before `.map`. No fallback/guard left inline.
3. Do **not** add the new module to `ENGINE_HASH_FILES`.

**Test file:** `tests/session4/advisory-projslice-canonicalizer.spec.ts`, asserting:
- **Byte-identical:** `computeAdvisoryHash` on canonical WA/GEN fixtures still ends with `|ff272d0d|1599` / `|85dcf73f|1561`.
- **No-op + idempotent:** `canonicalizeBudgetProjections(CANON)` deep-equals `CANON`; `canon(canon(x)) === canon(x)`.
- **Crash repro, value-asserted:** a `projections` array with `[null, {category:null...}, {amount:NaN...}, validRow]` (a) no longer throws, (b) yields a finite, deterministic hash, (c) equals the hash of the hand-cleaned equivalent (null dropped, cat → '', NaN amount → 0) — proving the documented Mode 1/2/3 are neutralized, not merely silenced.

---

## Sibling found (to log in Phase 1, fresh ID **P-UX-22**)

`computeMultiYearDetailed` / `computeGenericProjections` read `projections` raw via `.filter((p) => !p.is_revenue && p.category === '…')` (e.g. budgetEngine.ts:209, 212, 230, 304…). Equality comparisons are **null-`cat`/`sub`-safe** (a `null` just never matches), so Modes 2 is a non-issue there — but a **null array element** would throw on `!p.is_revenue` (Mode 1) at the engine boundary. This is an **engine-scope** sibling (would change `ENGINE_VERSION` if hardened) and is **out of P-UX-16 scope**. Verified-unused ID **P-UX-22** reserved; to be logged in BACKLOG.md during Phase 1.

---

## Phase 0 summary

- **Where:** `projSlice`, `buildSchoolContext.ts:80–93`, inside `canonicalizeProjectionInputs`; sole downstream = `computeAdvisoryHash` (advisory cache + scenarios.base_data_hash).
- **Undefended:** maps raw `BudgetProjection[]`; no canonicalizer, unlike `fundingSlice` (P-UX-18) and unlike the `?? ''`-defaulted sort keys of `posSlice`. Premise correction: it reads `budget_projections`, **not** pre-opening data.
- **Repro:** Mode 1 null element → throw at :82; Mode 2 null `cat`/`sub` → `localeCompare` throw at :91/:92; **Mode 3 non-finite `amount` → silent `NaN`→`null` hash corruption at :86** (most dangerous).
- **Reuse vs new:** distinct `BudgetProjection` shape, no existing defense → **new `canonicalizeBudgetProjections`, COERCE semantics** (mirror P-UX-18, preserve projSlice's keep-all-rows behavior), excluded from `ENGINE_HASH_FILES`.
- **Baseline (verified green now):** WA `v3-2026-05|53ec6cd11605|ff272d0d|1599`, Generic `v3-2026-05|53ec6cd11605|85dcf73f|1561`. These must be byte-identical after the fix → no cache invalidation.

**HARD STOP — awaiting explicit approval before any code.**
