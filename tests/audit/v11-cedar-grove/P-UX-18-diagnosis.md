# P-UX-18 - Harden startup_funding at the engine boundary (Phase 0 diagnosis)

Root-cause fix for overnight-E2E Divergence #1: raw `profile.startup_funding` crashes the
engine on malformed entries. Same bug class as P-UX-11 (hardened the advisory-hash
canonicalizer), different reader (the engine reads RAW). Read-only diagnosis; HARD STOP
for decisions follows. No code, no DB writes.

ID check vs BACKLOG.md: P-UX-10..P-UX-17 taken -> this is **P-UX-18** (free). The advisory
`projSlice` sibling is ALREADY tracked as **P-UX-16**. A NEW sibling (pre_opening_* readers)
is untracked - logged as a candidate in D3, not fixed here.

## (1) Reproduce - exact stacks captured
Feeding `startup_funding = [null, {amount:"x"}, "garbage", {valid}]`:

| Reader | Site | Throw |
|---|---|---|
| `computeCarryForward` | budgetEngine.ts:107 `sources.reduce((s,f)=>s+f.amount,0)` | `Cannot read properties of null (reading 'amount')` |
| `getGrantRevenueForYear` | budgetEngine.ts:63 `if (src.yearAllocations && ...)` | `Cannot read properties of null (reading 'yearAllocations')` |
| `getGrantAllocationsForYear` | budgetEngine.ts:85 (same expr) | `Cannot read properties of null (reading 'yearAllocations')` |

The overnight error was `reading 'amount'` = `computeCarryForward:107` (the dashboard calls
`computeCarryForward(profile)` for `preOpenCash` BEFORE `computeMultiYearDetailed`), so the
prompt's cited line 63 is the second reader, not the first to throw. Both must be hardened.

## (2) Every raw reader of `profile.startup_funding` reachable from the engine
All in `src/lib/budgetEngine.ts`; three functions actually iterate entries:

| Reader | Lines | Reads | Callers |
|---|---|---|---|
| `getGrantRevenueForYear(sources, year)` | 55-75 | `src.yearAllocations`, `src.selectedYears`, `src.amount` | `computeMultiYearDetailed:577`, `computeGenericProjections:1274` |
| `getGrantAllocationsForYear(sources, year)` | 78-95 | + `src.source` | export / per-source breakdown callers |
| `computeCarryForward(profile)` | 105-125 | `profile.startup_funding` directly: `f.amount` (107), `src.selectedYears`/`yearAllocations`/`amount` (111-114) | dashboard pages for `preOpenCash`; independent public entry |

Key fact for D1: there is **no single engine funnel**. `computeMultiYearDetailed` delegates
to `getGrantRevenueForYear`, but `computeCarryForward` and `getGrantAllocationsForYear` are
**independent public entry points** that read raw. Canonicalizing only at
`computeMultiYearDetailed` entry would leave `computeCarryForward` (the actual overnight
crash site) unprotected. The three iterating readers are the real data-entry boundary.

`scenarioEngine.ts:133` passes `profile.startup_funding` into the engine -> protected
transitively once the readers canonicalize.

## (3) P-UX-11 canonicalizer (`buildSchoolContext.ts`) - NOT value-preserving for the engine
`coerceSource` (38-42): string->unchanged, null->'', numeric->String(). Reusable as-is.

`fundingSlice` (105-118) is **hash-oriented, NOT value-preserving**:
- (a) null/non-object entries: `.filter(f != null && typeof === 'object')` - REUSABLE logic.
- (b) `source`: `coerceSource` - REUSABLE.
- (c) `amount`: `Math.round(f.amount ?? 0)` - coerces, but ROUNDS (lossy for the slice; fine
  for a hash, not what the engine wants - though canonical amounts are integers).
- (d) `yearAllocations`: converted to a **sorted array of `[key, value]` pairs**; the engine
  reads `yearAllocations[year]` as an **object** -> feeding the slice shape would BREAK the
  engine. Also SORTS `selectedYears` and SORTS + renames all fields (src/amt/t/s/yrs/alloc).

Conclusion: the slice is a stable-hash projection, not an engine-consumable
`StartupFundingSource[]`. I cannot reuse `fundingSlice` for the engine. The shared,
value-preserving piece is: array guard + null/non-object filter + `coerceSource` + finite
`amount` coercion + safe `yearAllocations`/`selectedYears`, emitting a real
`StartupFundingSource[]` with valid values UNCHANGED.

## (4) Idempotency
A value-preserving canonicalizer (filter garbage; coerce only invalid fields; pass valid
entries' values through untouched; do NOT sort, do NOT round valid numbers) is a strict
no-op on canonical input -> guarantees byte-identical engine output for the 25 prod rows and
every pathway. This is the property the byte-identical test will pin.

## Sibling raw-read crash classes found (D3 - LOG, do not fix here)
- `computeCarryForward:120` `pre_opening_transactions.reduce((s,tx)=>s+tx.amount,0)` and
  `:121` `pre_opening_expenses.reduce((s,e)=>s+e.budgeted,0)` - null entry -> same crash
  (`reading 'amount'`/`'budgeted'`). Reproduced. **New backlog candidate (untracked).**
- Advisory `projSlice` brittleness is ALREADY tracked as **P-UX-16** (OPEN).
Both kept OUT of this pass (scope = startup_funding).

---

## DECISIONS NEEDED (HARD STOP - no code until approved)

### D1 - Boundary location
- **Recommend: canonicalize inside the three iterating readers** (`getGrantRevenueForYear`,
  `getGrantAllocationsForYear`, `computeCarryForward`) via the shared fn. Rationale: these
  are the ONLY functions that read raw entries; protecting them protects every current and
  future caller (computeMultiYearDetailed, computeGenericProjections, scenarioEngine,
  exports, UI), regardless of entry point. Contained to budgetEngine.ts. Idempotent =>
  byte-identical.
- Rejected: `computeMultiYearDetailed`-entry-only - INSUFFICIENT (misses `computeCarryForward`,
  the actual overnight crash site, and `getGrantAllocationsForYear`).
- Alternative (broader): profile-hydration canonicalization - one application point but
  higher blast radius (touches the hydration layer for all pathways/surfaces). Available if
  you prefer one site over three.
- Note: this is not the rejected "scattered band-aid" - it is ONE shared definition applied
  at the engine's three actual data-entry doors (there is no single door).

### D2 - Reuse vs extend the P-UX-11 helper
- The P-UX-11 `fundingSlice` is hash-oriented and CANNOT be reused for the engine (breaks
  `yearAllocations` object access). **Recommend: create ONE shared value-preserving
  `canonicalizeStartupFunding(raw): StartupFundingSource[]`** in a new low-level
  `src/lib/startupFunding.ts` (mirrors customLines.ts / facilityFinancing.ts), move/share
  `coerceSource` there, and have BOTH readers use it: the engine's three readers call it
  directly; the advisory `fundingSlice` builds its hash projection ON TOP of its output
  (canonicalize first, then sort/slice). Net: one shape-defense definition shared by both
  paths; the advisory's hash-specific sorting stays advisory-local. Placement avoids any
  circular import (both budgetEngine and buildSchoolContext import from the new leaf module).

### D3 - Scope guard
- Keep this pass to `startup_funding` only. **Log the `pre_opening_transactions` /
  `pre_opening_expenses` null-entry crash in `computeCarryForward` as a NEW backlog
  candidate** (note the P-UX-16 / P-UX-11 family link). Do not fix here.

### ID
- **P-UX-18** (verified free in BACKLOG.md).
