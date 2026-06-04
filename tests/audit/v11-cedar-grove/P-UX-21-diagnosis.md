# P-UX-21 — Engine-version token in computeAdvisoryHash (Phase 0 diagnosis)

Root-cause fix for Divergence #2's mechanism. Read-only diagnosis; HARD STOP for the
mechanism decision. `tests/**` excluded from prod build.

MCP pre-flight: supabase LIVE (ref nlvlrznhiwuorxlapnej confirmed); github LIVE (read-only);
typescript-lsp UNAVAILABLE (grep fallback); context7 not consulted yet (would confirm the
Next-16 prebuild detail if content-hash is approved).

## Premise corrections
- The token is **`PROMPT_VERSION`** (`buildSchoolContext.ts:16`, `'v3-2026-05'`), not
  "AGENT_PROMPT_VERSION".
- **Cache-miss behavior is NOT auto-recompute.** On hash MISMATCH the pages serve the cached
  briefing and set `modelChanged = true` (the "Model Changed" banner); auto-generate happens
  ONLY when there is no cache at all (advisory/page.tsx:227-230; overview dashboard/page.tsx
  mirrors it). So P-UX-21 doesn't "lazily recompute" — it makes the **stale banner fire
  correctly on engine changes** (today it never fires on an engine change because the hash
  matches). This is safer than auto-recompute: no API storm, cannot crash. (Corrects Phase 0 Q5.)

## Q1 — Hash machinery
`computeAdvisoryHash(input)` in `src/lib/buildSchoolContext.ts:152`:
```
const canonical = canonicalizeProjectionInputs(input)   // JSON of {v:PROMPT_VERSION, profile, fa, positions, projections, gep, funding}
return `${PROMPT_VERSION}|${djb2(canonical)}|${canonical.length}`
```
PROMPT_VERSION is injected TWICE — as `v:` inside the canonical JSON (:125) and as the hash
prefix (:154). **Where it runs: BOTH client and server.** Client: advisory/page.tsx:127,
dashboard/page.tsx:103, scenarios/page.tsx:116. Server: api/scenarios/calculate/route.ts:57
(via the `hashProjectionInputs` alias, :158). => an engine token must be reachable in BOTH the
client and server bundles. djb2 is sync, dep-free, browser+node safe.

## Q2 — Staleness mechanism (confirmed in code)
The hash folds inputs + PROMPT_VERSION + length, but **no engine-code version**. Store/compare:
`dataHash` lives INSIDE `advisory_cache` JSONB (types.ts:164; there is no separate
`advisory_data_hash` column — confirmed in P-UX-20). The client computes `currentDataHash` and
compares to `cached.dataHash`. Match -> serve cached (no banner). Mismatch -> serve cached +
`modelChanged` banner. No cache -> `fetchAdvisory()` (recompute). The recompute/miss path
cannot crash (normal generate flow). So when engine math changes but inputs don't, the hash
stays equal, the banner never fires, and the school is served stale advisory numbers while live
tiles show corrected ones — exactly Divergence #2 (May-12 cache = 84 vs live = 88).

## Q3 — Engine surface (files whose changes should invalidate advisory caches)
Confirmed all exist. Number-affecting engine (RECOMMEND tracking):
`budgetEngine.ts`, `calculations.ts`, `customLines.ts`, `facilityFinancing.ts`,
`startupFunding.ts`, **`preOpening.ts`** (P-UX-19; omitted from the prompt's candidate set —
carry-forward feeds advisory), **`gradeExpansion.ts`** (enrollment -> revenue/staffing; omitted),
`staffingDefaults.ts` (salary catalog -> personnel), **`stateConfig.ts`** (pathway selection +
WA defaults; omitted). 
Borderline: `buildSchoolContext.ts` — it builds the advisory prose/metrics, but intentional
prompt/context changes are already covered by bumping PROMPT_VERSION; including it in a
content-hash means any edit (even comments) invalidates. Decision item (lean: include the
nine number-engine files; rely on PROMPT_VERSION for prose). Over-inclusion is the safe direction.

## Q4 — Three-mechanism evaluation
| Mechanism | Correctness | Granularity | Forgettable? | Feasibility (client+server) | Cost |
|---|---|---|---|---|---|
| **1. Manual `ENGINE_VERSION` const** | only if bumped | exact (when bumped) | YES — this bug is proof the team forgets | trivial (a const in a shared module) | ~0 |
| **2. Build-time engine content-hash** | always | exact (engine change only) | no human step | generate `src/lib/engineVersion.ts` in a `prebuild` script; imported by buildSchoolContext -> bundled client+server | one prebuild step |
| **3. Git SHA (`VERCEL_GIT_COMMIT_SHA`)** | always | TOO BROAD — every deploy busts all caches incl. UI/docs/test-only pushes | n/a | needs NEXT_PUBLIC_ env embedded at build | ~0 but wasteful |

This repo deploys very frequently (UI/test/docs), so #3 makes the cache near-useless during
active dev — **not recommended**. #1 reproduces THIS bug on the first forgotten bump.

**RECOMMENDATION: #2 (engine content-hash).** Right granularity, no forgettable human step.
Feasibility confirmed:
- `package.json` has plain `"build": "next build"`. Add `"prebuild": "node scripts/gen-engine-version.mjs"`
  (npm auto-runs `prebuild` before `build`; Vercel runs `npm run build` so it fires). Optionally
  `"predev"` too, but committing the generated file covers dev.
- `scripts/gen-engine-version.mjs`: read the Q3 engine file set, **normalize line endings
  (strip `\r`)** before hashing (CRITICAL — Windows dev CRLF vs Vercel Linux LF would otherwise
  produce different hashes and bust caches on every Vercel build, defeating the granularity),
  sha256 the sorted concatenation, write `export const ENGINE_VERSION = '<first 8 hex>'`.
- Commit the generated `src/lib/engineVersion.ts` so dev + repo always have it; prebuild keeps it
  fresh on every build. Deterministic: identical normalized source -> identical hash, so a deploy
  that doesn't touch the engine regenerates the SAME token (no spurious invalidation). This is the
  decisive advantage over #3.
- buildSchoolContext imports `ENGINE_VERSION` and folds it in at the PROMPT_VERSION injection point.
**Fallback: #1** if you judge the prebuild step disproportionate for a 25-school deployment.

## Q5 — One-time ship effect (corrected)
Adding a 4th segment changes the hash FORMAT (`v3-2026-05|<engine>|<djb2>|<len>`), so all 7
existing caches (Q6) mismatch on first access -> each shows the Model-Changed banner once until
regenerated. **Not auto-recompute** (see premise correction), so **no thundering herd / no API
storm** — banners only. Cannot crash. The 7 known-stale caches become correctly flagged instead
of silently stale.

## Q6 — Blast radius
25 schools total; **7 have an advisory_cache** (all `v3-2026-05|` format). So 7 caches get
correctly invalidated on first post-deploy access; the other 18 have no cache (generate fresh).
Also affects `scenarios.base_data_hash` (same hash) — scenario staleness will likewise flag on
engine change (correct).

## Q7 — Uniformity & no output change
`computeAdvisoryHash` is pathway-agnostic (one function for WA + Generic), so both benefit. This
is a **cache-key change only** — no engine function touched, advisory OUTPUT for a given
(inputs + engine version + prompt version) is identical; only *when the cache flags stale* changes.

## Recommended plan + test
- `scripts/gen-engine-version.mjs` (LF-normalized sha256 of the Q3 files -> `src/lib/engineVersion.ts`).
- `package.json`: add `prebuild`.
- `buildSchoolContext.ts`: import `ENGINE_VERSION`, fold into the hash (prefix segment).
- Doc: mark Divergence #2 closed (permanent fix = P-UX-21) in the overnight RECON/morning report.
- Test `tests/session4/advisory-hash-engine-version.spec.ts`: hash changes when ENGINE_VERSION
  changes; stable when nothing changes; PROMPT_VERSION bump still invalidates; old 3-segment hash
  mismatches the new 4-segment format (self-heal); engine pins WA 350000 / Generic 120000 untouched.

---
**HARD STOP.** Decision needed: mechanism **#2 content-hash (recommended)** vs **#1 manual
constant (fallback)** vs #3 git-SHA (not recommended). Sub-decisions if #2: (a) engine file set
(include preOpening/gradeExpansion/stateConfig? include buildSchoolContext or rely on
PROMPT_VERSION?); (b) confirm the LF-normalization + commit-the-generated-file approach. No code
until you approve.
