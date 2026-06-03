# P-UX-11 Diagnosis: harden startup_funding canonicalizer

Status: investigation only (no code written). typescript-lsp down -> grep + tsc
fallback. supabase used READ ONLY to inspect real startup_funding shapes.

HEADLINE: the crash is LATENT. All 25 existing school_profiles rows with
startup_funding are canonical, well-formed arrays (verified: 0 non-array rows, 0
entries that are non-object / missing source / non-string source). No production
row crashes today. The bug triggers only on non-canonical shapes built OUTSIDE
the Revenue editor - the philanthropy / CSP fixture data about to be seeded for
R-REV-03 / R-REV-07 validation. This fix is the enabler for that seeding.

---

## D1 - Crash site

src/lib/buildSchoolContext.ts:96, inside canonicalizeProjectionInputs, in the
fundingSlice pipeline:

    const fundingSlice = (profile.startup_funding ?? [])
      .map(f => ({ src: f.source, amt: Math.round(f.amount ?? 0), t: f.type, s: f.status, ... }))
      .sort((a, b) => a.src.localeCompare(b.src))   // <- line 96 throws

When an entry has no string `source`, `a.src` is undefined and
`undefined.localeCompare(...)` throws a TypeError. Sibling throw vectors exist in
the same pipeline (see D3).

Callers (the dashboard paths that run this on load via computeAdvisoryHash):
- src/app/(authenticated)/dashboard/page.tsx:103  (Overview useMemo) - the
  surface that crashes the dashboard on mount.
- src/app/(authenticated)/dashboard/advisory/page.tsx:127
- src/app/(authenticated)/dashboard/scenarios/page.tsx:116
- src/app/api/scenarios/calculate/route.ts:57 (hashProjectionInputs, server side)
computeAdvisoryHash (buildSchoolContext.ts:145) wraps the private
canonicalizeProjectionInputs and is the only public entry point.

---

## D2 - Canonical shape

From the Revenue-tab editor write path (src/app/(authenticated)/dashboard/revenue/page.tsx):
- Top level: a JSON ARRAY (StartupFundingSource[]). Saved verbatim at
  revenue/page.tsx:115 (.update({ startup_funding: fundingSources })).
- Each entry (src/lib/types.ts StartupFundingSource):
    source: string
    amount: number
    type: 'grant' | 'donation' | 'debt' | 'other'
    status: 'received' | 'pledged' | 'applied' | 'projected' | 'n/a'
    selectedYears?: number[]
    yearAllocations?: Record<number, number>
- addSource() seeds { source: '', amount: 0, type: 'grant', status: 'projected',
  selectedYears: [], yearAllocations: {} }.
- DEFAULT_SOURCES (revenue/page.tsx:24) are two canonical entries.

Observed DB confirms this exactly. Representative real (CSP/philanthropy) rows:
  [{ "type":"grant","amount":350000,"source":"Federal CSP Grant",
     "status":"projected","selectedYears":[0,1,2,3,4],
     "yearAllocations":{"0":350000,"1":0,"2":0,"3":0,"4":0} }]
  multi-entry rows add sources like "ESWA", "NSVF", "New Schools Venture Fund",
  "WA Charter School Program (CSP) Grant", "Founder Savings / Personal Investment".
All canonical. JSON object key order in the DB ("type" before "source") is
irrelevant - the canonicalizer re-projects to its own field set, so stored key
order does not affect output.

---

## D3 - Crashing shapes (failure-mode taxonomy)

Because no crashing row exists yet, these are the shapes the about-to-be-seeded
fixtures (hand-written SQL / MCP edits / imports) can take, derived from the
code's fragility. THROW vectors:

1. Non-array top level. e.g. startup_funding = a keyed object
   { "Federal CSP Grant": 350000 } or a scalar. -> `.map` is not a function;
   throws before the sort. (Today guarded only against null/undefined via `?? []`,
   NOT against a non-array value.)
2. Null or non-object array entry. e.g. [null] or ["Federal CSP Grant"].
   -> reading `f.source` on null throws; on a string/number entry, src becomes
   undefined and the sort's localeCompare throws.
3. Entry missing a string `source`. e.g. an importer that uses a different key
   ({ name: "ESWA", amount: 100000 }) or sets source: null. -> src is
   undefined/null -> a.src.localeCompare(b.src) throws. THIS is the reported bug.

NON-throwing but degraded (documented, not crashes):
4. amount as a numeric string ("350000") -> Math.round coerces fine; a
   non-numeric string -> NaN -> serialized as null. No throw.
5. type / status missing -> carried through as undefined; JSON.stringify drops
   them. No throw.
6. yearAllocations as a non-object truthy value -> Object.keys coerces (e.g.
   number -> []); selectedYears non-array -> guarded to null. No throw.

Related latent risk OUTSIDE startup_funding (flagged, not in the reported
vector): projSlice at lines 71-72 sorts on `a.cat.localeCompare` / `a.sub` with
NO `?? ''` default (unlike posSlice/gepSlice which default their sort keys). A
budget_projections row missing category/subcategory would throw the same way.
Projections are editor/DB-controlled (NOT NULL in practice) so the risk is low,
but it is the same class of bug in the same function. Decision item for the
checkpoint: harden cat/sub in the same pass (trivial pure superset) or log to
backlog.

---

## D4 - Data-preservation question

The canonicalizer's output is a hash-input string for cache invalidation, so
"preserve data" means the serialization must still reflect each entry's real
funding values (so distinct funding sets hash distinctly), not silently collapse
them.

- Shape 3 (missing/odd source) WITH a real amount/type: PRESERVE amount, type,
  status, allocations; coerce source to a string (numeric -> its digits; absent
  -> ''). Real funding data is kept; only the missing name degrades to ''.
- Shape 2 (null / non-object entry): DROP that entry (nothing to preserve) but
  KEEP the other good entries in the same array - do not nuke the whole set for
  one bad element.
- Shape 1 (non-array top level): fail safe to [] (an unusable funding list);
  nothing recoverable as a list.
- Already-canonical entries: untouched, byte-identical output (the
  behavior-preserving guard).

---

## D5 - Verification surface

- canonicalizeProjectionInputs is pure (no I/O); its public wrapper
  computeAdvisoryHash is already unit-tested directly in
  tests/session4/advisory-hash.spec.ts with synthetic ProjectionHashInputs.
  New unit tests will feed crafted profile.startup_funding shapes (the D3
  taxonomy) to computeAdvisoryHash and assert: no throw; canonical-shaped result;
  byte-identical hash for already-canonical input; safe default (empty funding)
  for garbage. The existing 19 advisory-hash tests (which include canonical
  startup_funding entries and pin determinism + startup_funding sensitivity at
  spec line 173) act as the regression guard that canonical output did not move.
- Dashboard render surface: dashboard/page.tsx (Overview) computes the hash at
  :103 on mount. Phase 2 seeds a previously-crashing shape into
  test-columbia@schoollaunch.test, loads the Overview via Playwright, confirms no
  crash, then RESTORES the row (before/after captured for auditability).

---

## Recommended fix (one paragraph)

Harden the fundingSlice pipeline inside canonicalizeProjectionInputs only, as a
pure superset: (a) coerce the top level with Array.isArray(profile.startup_funding)
? ... : [] (replacing the `?? []` that only catches null/undefined); (b) filter
out null / non-object entries before mapping; (c) make src a guaranteed string
(typeof f.source === 'string' ? f.source : String(f.source ?? '')). Leave amt,
t, s, yrs, alloc mapping exactly as-is so already-canonical entries serialize
byte-identically. This preserves real funding data per D4, fails safe (no throw)
on genuine garbage, and changes nothing for the 25 canonical rows or the editor
path. No schema change. The projSlice cat/sub latent risk is a separate decision
(harden in-pass vs backlog).
