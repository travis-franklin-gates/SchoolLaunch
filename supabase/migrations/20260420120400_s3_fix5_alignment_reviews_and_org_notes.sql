-- Session 3, Fix 5 (AUDIT 4.5 + 4.6):
--
-- 4.5 alignment_reviews "School CEOs can manage" ALL policy excluded school_editor. Per
-- CLAUDE.md data-table convention, editors should also be able to INSERT/UPDATE/DELETE
-- alignment reviews for their own school. Keep the existing SELECT policy (broad:
-- school-linked users + org_admin + super_admin), replace the ALL policy with a write
-- policy scoped to {ceo, editor} of target school, org_admin of target org, or super_admin.
--
-- 4.6 org_notes "org notes access" ALL policy had no role filter — any user in user_roles
-- with that organization_id (including school_viewer) could INSERT/UPDATE/DELETE org notes.
-- Split into SELECT (any member of the org can read) and write (org_admin of target org
-- or super_admin only). School-level roles (ceo/editor/viewer) get read-only visibility
-- into org-level notes; writes are an org-admin concern.

-- ============================================================
-- alignment_reviews
-- ============================================================
DROP POLICY IF EXISTS "School CEOs can manage their alignment reviews" ON public.alignment_reviews;

CREATE POLICY "alignment_reviews_write_ceo_editor_admin"
ON public.alignment_reviews
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role IN ('school_ceo', 'school_editor') AND ur.school_id = alignment_reviews.school_id)
        OR (ur.role = 'org_admin' AND ur.organization_id = (
          SELECT s.organization_id FROM public.schools s WHERE s.id = alignment_reviews.school_id
        ))
        OR ur.role = 'super_admin'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role IN ('school_ceo', 'school_editor') AND ur.school_id = alignment_reviews.school_id)
        OR (ur.role = 'org_admin' AND ur.organization_id = (
          SELECT s.organization_id FROM public.schools s WHERE s.id = alignment_reviews.school_id
        ))
        OR ur.role = 'super_admin'
      )
  )
);

-- ============================================================
-- org_notes
-- ============================================================
DROP POLICY IF EXISTS "org notes access" ON public.org_notes;

CREATE POLICY "org_notes_select_own_org"
ON public.org_notes
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND organization_id IS NOT NULL
  )
);

CREATE POLICY "org_notes_write_admin_or_super"
ON public.org_notes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'org_admin' AND ur.organization_id = org_notes.organization_id)
        OR ur.role = 'super_admin'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'org_admin' AND ur.organization_id = org_notes.organization_id)
        OR ur.role = 'super_admin'
      )
  )
);
