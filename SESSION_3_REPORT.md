# Session 3 Report — Authorization Hardening Sweep

**Date:** 2026-04-20
**Scope:** Six authorization fixes from AUDIT_REPORT.md (findings 4.1–4.6, 6.1) — pre-demo security hardening.
**Branch:** `master` (no commits yet — Travis pushes manually).
**Session 1 Playwright baseline (pre):** 8/8 green. **Post:** 11/11 green (8 original + 3 new scenarios-auth).

---

## Fix 1 (AUDIT 4.1, HIGH) — Invitations anonymous enumeration

**Problem:** `invitations` had a SELECT policy `USING (true)` so any anonymous client could enumerate every invitation row (email + token included).

**Change:**
- Created SECURITY DEFINER RPC `public.get_invitation_by_token(p_token text)` — returns at most one row, enforces token match + not-accepted + not-expired inside the database. `token` column intentionally omitted from the return shape (caller already has it).
- `REVOKE ALL … FROM public; GRANT EXECUTE … TO anon, authenticated;` locks direct table access out.
- Dropped the old `"public can read invitation by token"` policy.
- Updated `src/app/invite/page.tsx` to call the RPC via anon client; service role retained only for the downstream `auth.admin.listUsers()` + schools name lookup (narrower blast radius).

**Migration:** `20260420120000_s3_fix1_invitation_by_token_rpc.sql`

**Verification:** Build passed. Playwright 8/8. Manual confirmation that anon clients can no longer `SELECT * FROM invitations`.

---

## Fix 2 (AUDIT 4.2, MEDIUM) — Invitations ALL policy scope

**Problem:** The `"invitation access"` ALL policy filtered only by `organization_id IN (user_roles.organization_id …)` — no role filter. Any org member (including `school_viewer`) could INSERT/UPDATE/DELETE invitations anywhere in the org.

**Change:** Split into two policies:
- `invitations_select_own_org` — read-only visibility for any member of the same organization.
- `invitations_write_ceo_or_admin` — FOR ALL with USING+WITH CHECK requiring `(school_ceo AND school_id match)` OR `(org_admin AND org_id match)` OR `super_admin`.

**Migration:** `20260420120100_s3_fix2_invitations_split_scoped_policies.sql`

**Verification:**
- Cross-school CEO INSERT → RLS denied (42501). ✓
- Same-school CEO INSERT → 1 row inserted. ✓
- org_admin INSERT for sibling school in own org → 1 row inserted. ✓
- school_viewer case skipped (no viewer accounts in test data).

---

## Fix 3 (AUDIT 4.3, MEDIUM) — schools UPDATE role-gate

**Problem:** `"school ceos update own school"` UPDATE policy matched any row in `user_roles` with the same `school_id` — editors and viewers could rename schools.

**Change:** Replaced with `schools_update_ceo_or_admin` requiring:
- `school_ceo AND school_id = schools.id`, OR
- `org_admin AND organization_id = schools.organization_id`, OR
- `super_admin`.

**Migration:** `20260420120200_s3_fix3_schools_update_role_gate.sql`

**Verification:**
- school_editor UPDATE → 0 rows affected. ✓
- school_ceo UPDATE own school → 1 row. ✓
- org_admin UPDATE school in own org → 1 row. ✓

---

## Fix 4 (AUDIT 4.4, MEDIUM) — schools SELECT siloed visibility

**Intent decision (Travis):** **Option A — siloed.** A user sees only schools they are directly attached to via `user_roles.school_id`, plus org_admin sees their whole org and super_admin sees all.

**Problem:** `"org admins see their schools"` SELECT policy had no role filter, so every org member saw every school in their org — not admin-only. The companion `"school ceos see own school"` already correctly matches any role linked to that school.

**Change:** Replaced the mis-named policy with `schools_select_org_admin_or_super`, role-gated to `org_admin` (scoped to their organization) and `super_admin` (all rows). The `"school ceos see own school"` policy was retained unchanged — despite the name, its filter (`id IN user_roles.school_id` for current user) correctly covers ceo/editor/viewer at their own school.

**Migration:** `20260420120300_s3_fix4_schools_select_siloed.sql`

**Verification:**
- Columbia Valley CEO (org `...001`) → sees only Columbia Valley, not sibling Cedar Grove. ✓
- Multi-role user (CEO at Cascade + Editor at Spokane Arts) → sees exactly those two. ✓
- org_admin → sees all 13 schools in org `...001`. ✓

---

## Fix 5 (AUDIT 4.5 + 4.6) — alignment_reviews & org_notes

### 4.5 alignment_reviews
**Problem:** `"School CEOs can manage their alignment reviews"` ALL policy excluded `school_editor`. Per CLAUDE.md's data-table convention, editors should also be able to INSERT/UPDATE/DELETE.

**Change:** Replaced with `alignment_reviews_write_ceo_editor_admin` covering ceo+editor of target school, org_admin of target org, and super_admin. Existing broader SELECT policy retained.

### 4.6 org_notes
**Problem:** `"org notes access"` ALL policy had no role filter — any user (including school_viewer) with an org_id in user_roles could write org notes.

**Change:** Split into:
- `org_notes_select_own_org` — any member of the org can read.
- `org_notes_write_admin_or_super` — `org_admin` of target org or `super_admin` only.

**Migration:** `20260420120400_s3_fix5_alignment_reviews_and_org_notes.sql`

**Verification:**
- Editor INSERT alignment_review for own school → 1 row. ✓
- Editor INSERT alignment_review for different school → RLS denied. ✓
- CEO INSERT org_note → RLS denied. ✓
- org_admin INSERT org_note in own org → 1 row. ✓
- CEO SELECT org_notes in own org → visible (1 row). ✓

---

## Fix 6 (AUDIT 6.1, HIGH) — Scenarios endpoints authenticateRequest

**Problem:** `/api/scenarios/seed` and `/api/scenarios/calculate` did `supabase.auth.getUser()` but then used `createServiceRoleClient()` with `schoolId` straight from the request body — bypassing school-level access control. A logged-in CEO at School A could mutate scenarios at School B.

**Change:** Replaced the manual auth check with `authenticateRequest(request, { schoolId, requireRoles: ['school_ceo', 'school_editor', 'org_admin'] })` in both routes. The helper enforces auth + school membership + role gating; super_admin bypasses. Extracted schoolId explicitly and passed it in `options.schoolId` so the helper doesn't need to re-parse the already-consumed body.

**Files:**
- `src/app/api/scenarios/seed/route.ts`
- `src/app/api/scenarios/calculate/route.ts`

**Playwright coverage extended:** New spec `tests/session1/scenarios-auth.spec.ts` — Suite 5, three tests:
- A) Unauthenticated → 401.
- D) Missing schoolId → 400.
- B/C) Own school passes gate, cross-school → 403.

**Verification:** Build green. Playwright 11/11 (added suite 5 × 3 tests passes).

---

## Deliverables

### Migration files (applied to Supabase project `nlvlrznhiwuorxlapnej`):
1. `supabase/migrations/20260420120000_s3_fix1_invitation_by_token_rpc.sql`
2. `supabase/migrations/20260420120100_s3_fix2_invitations_split_scoped_policies.sql`
3. `supabase/migrations/20260420120200_s3_fix3_schools_update_role_gate.sql`
4. `supabase/migrations/20260420120300_s3_fix4_schools_select_siloed.sql`
5. `supabase/migrations/20260420120400_s3_fix5_alignment_reviews_and_org_notes.sql`

### Application code:
- `src/app/invite/page.tsx` (RPC lookup instead of anon table read)
- `src/app/api/scenarios/seed/route.ts` (authenticateRequest)
- `src/app/api/scenarios/calculate/route.ts` (authenticateRequest)

### Tests:
- `tests/session1/scenarios-auth.spec.ts` (new, Suite 5, 3 tests)

### Final policy state (affected tables):

| Table | Policies |
|---|---|
| `invitations` | `invitations_select_own_org` (SELECT), `invitations_write_ceo_or_admin` (ALL) |
| `schools` | `school ceos see own school` (SELECT), `schools_select_org_admin_or_super` (SELECT), `schools_update_ceo_or_admin` (UPDATE) |
| `alignment_reviews` | `Users can view their school's alignment reviews` (SELECT), `alignment_reviews_write_ceo_editor_admin` (ALL) |
| `org_notes` | `org_notes_select_own_org` (SELECT), `org_notes_write_admin_or_super` (ALL) |

---

## Follow-ups / caveats

- **No school_viewer test account exists.** Fix 2 and Fix 5 viewer-denial paths were not exercised against a real viewer user. The role is covered by the positive logic (only explicit ceo/editor/admin/super roles satisfy the WITH CHECK), but adding a viewer fixture to `tests/session1/fixtures.ts` would tighten coverage for future sessions.
- **Policy name drift.** The retained `"school ceos see own school"` policy on `schools` actually matches any school-linked role (editor/viewer too) — not just CEOs. Behavior is correct for Option A, but the name is misleading. Left unrenamed to minimize churn; a future cleanup could rename to `schools_select_own_school`.
- **No commits.** Travis pushes manually.
