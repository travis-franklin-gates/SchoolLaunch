# P-UX-19 — Harden pre_opening_transactions / pre_opening_expenses at the engine boundary (Phase 0)

Sibling of P-UX-18 one layer over. Read-only diagnosis; HARD STOP for decisions follows.
No code, no DB writes. `tests/**/*` is excluded from the prod build (build-unbreak commit),
so this file never reaches the Vercel typecheck.

MCP pre-flight: supabase LIVE (project ref nlvlrznhiwuorxlapnej confirmed via get_project_url);
github LIVE (read-only) — but P-UX-18 is UNCOMMITTED locally, so I mirror its pattern from the
working tree, not a pushed commit; typescript-lsp UNAVAILABLE (no server) -> fell back to
grep + tsx repro + tsc (sufficient; not a required abort). context7 not needed (no new lib API).

## Wrong-premise corrections
- **Line numbers:** premise says "~120-121"; the actual reader is **budgetEngine.ts:128-130**
  (shifted by P-UX-18's added comment + canonicalize line). The named function
  `computeCarryForward` is correct.
- **Advisory exposure:** premise asks to check — answer is **NO** (see Q4). Unlike P-UX-18,
  neither field flows into the advisory hash, so there is NO hash projection to layer.

## Q1 — Reader sites (every read of either field)
| # | Site | Reads | Kind |
|---|---|---|---|
| 1 | `src/lib/budgetEngine.ts:128-130` (`computeCarryForward`) | `tx.amount` (:129), `e.budgeted` (:130) | **ENGINE (in scope)** |
| 2 | `src/app/(authenticated)/dashboard/multiyear/page.tsx:49-52` | `tx.amount` (:50), `e.budgeted` (:51) | UI — re-implements the same reduce INLINE |
| 3 | `src/app/(authenticated)/dashboard/cashflow/page.tsx:61-70,255-256` | reads into editor state; writes both fields | UI editor (canonical WRITER) |
| — | `buildSchoolContext.ts` | (none) | advisory does NOT read these |

The **only ENGINE reader is `computeCarryForward`** — one function reading both fields (P-UX-18
had three). Site #2 is both a crash vector AND a pre-existing single-source smell: the multiyear
page re-implements the preOpen reduce inline instead of calling `computeCarryForward` (and its
own `carryForward` memo, lines ~40-48, does NOT subtract preOpenExpenses, so it already diverges
from `computeCarryForward`). That DUPLICATION is out of scope here (a refactor, not a null-fix).

## Q2 — Shapes + crash path (reproduced)
Two DISTINCT shapes (`src/lib/types.ts`):
- `PreOpeningTransaction` = { id, month, description, **amount**, expense_category, created_at }
- `PreOpeningExpense` = { id, name, **budgeted**, actual, fundingSource? }
Stored as JSONB arrays on `school_profiles.pre_opening_transactions` / `pre_opening_expenses`
(nullable; default `[]`). Engine reads only `tx.amount` and `e.budgeted`.

Reproduced (tsx against current engine):
- `pre_opening_transactions: [null]` -> THROW `Cannot read properties of null (reading 'amount')` at :129.
- `pre_opening_expenses: [null]` -> THROW `Cannot read properties of null (reading 'budgeted')` at :130.
- `pre_opening_transactions: ['garbage']` -> NO throw, but `'garbage'.amount` is `undefined` ->
  `s + undefined` = **NaN** intermediate (masked here by the `> 0` check, but NaN leakage is a
  latent correctness bug). So the threat is BOTH: null/undefined entries throw; primitive /
  `{amount:'x'}` entries silently produce NaN.
- canonical (`[]`/well-formed) -> OK. Threat model = DB seed / import / backfill / CSP fixtures,
  not the in-app editor (which writes canonical shapes).

## Q3 — One canonicalizer or two?
**TWO** (matches the default expectation). The shapes are distinct and the coerced numeric field
differs (`amount` vs `budgeted`); a single function would have to branch on shape. Two small
value-preserving functions in one file are clearer and each is trivially idempotent. **Do NOT
reuse `canonicalizeStartupFunding`** (different shape).

## Q4 — Advisory exposure
**NONE.** `computeAdvisoryHash` / `canonicalizeProjectionInputs` (`buildSchoolContext.ts`) hash
profile demographics, assumptions, positions, projections, gradeExpansion, and funding — NOT
`pre_opening_*`. Grep confirms no read in `buildSchoolContext.ts`. Therefore: no hash projection
to layer (the P-UX-18 advisory-layering step does not apply), and the byte-identical advisory-hash
guard is trivially satisfied (these fields are not in the hash). I will still pin the hash as a
regression guard.

## Q5 — Byte-identical risk
The canonicalizer must: (a) array guard (non-array -> `[]`), (b) drop null/non-object entries,
(c) coerce the numeric field to a finite number (NaN/missing -> 0) WITHOUT altering valid numbers,
(d) preserve all other fields unchanged, (e) NOT sort, NOT round, NOT default-fill. On canonical
input it is a strict no-op -> `computeCarryForward` / `computeMultiYearDetailed` unchanged, and
`computeAdvisoryHash` unaffected (fields not hashed). Idempotent by construction.

## Q6 — Proposed fix shape (mirrors P-UX-18)
- **New file `src/lib/preOpening.ts`** exporting two value-preserving, idempotent canonicalizers:
  `canonicalizePreOpeningTransactions(raw): PreOpeningTransaction[]` and
  `canonicalizePreOpeningExpenses(raw): PreOpeningExpense[]`.
- **Reroute the ENGINE reader** `computeCarryForward` (budgetEngine.ts:128-130) to call them at
  the boundary (replace `profile.pre_opening_transactions || []` / `pre_opening_expenses || []`).
- **Test:** `tests/session4/pre-opening-engine-canonicalizer.spec.ts` — crash-repro now clean,
  no-op + idempotent on canonical, carry-forward pins (WA 350000 / Generic 120000), full
  `computeMultiYearDetailed` deep-equal raw-vs-canonicalized, `computeAdvisoryHash` unchanged.

## Scope decision needed from you (Q1 site #2/#3)
Recommend **engine-only** (computeCarryForward) to mirror P-UX-18's engine-boundary scope and
avoid drive-by. The UI readers are siblings:
- **multiyear/page.tsx inline reduce** — a real crash vector on the same fields. Option A: ALSO
  route it through the new canonicalizer (cheap, 2 lines, same defense). Option B: log as sibling.
  Note the carry-forward DUPLICATION (page re-implements instead of calling computeCarryForward)
  is a separate single-source issue -> log regardless (proposed **P-UX-20**, verified unused below).
- **cashflow/page.tsx** — the editor (canonical writer); lower crash risk; recommend log, not fix.

BACKLOG IDs: P-UX-18 is the highest existing P-UX; **P-UX-19** = this. The sibling(s) would be
**P-UX-20** (verify unused before assigning).

---
**HARD STOP.** Awaiting approval: (1) two canonicalizers in `src/lib/preOpening.ts`; (2) scope =
computeCarryForward only, or include the multiyear UI reader; (3) log multiyear carry-forward
duplication (+ cashflow) as P-UX-20. No code until you reply.
