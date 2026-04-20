-- Session 3, Fix 4 (AUDIT 4.4): The "org admins see their schools" SELECT policy had no role
-- filter — any user with a row in user_roles could SELECT every school in their organization,
-- leaking sibling-school visibility to editors/viewers. Option A (siloed visibility) confirmed:
-- a user sees only the schools they are directly attached to via user_roles.school_id, except
-- org_admin (sees org-wide) and super_admin (sees all).
--
-- The companion policy "school ceos see own school" already matches any role linked to that
-- school (id IN user_roles.school_id for auth.uid()), which correctly covers school_ceo,
-- school_editor, and school_viewer for the schools they are attached to.

DROP POLICY IF EXISTS "org admins see their schools" ON public.schools;

CREATE POLICY "schools_select_org_admin_or_super"
ON public.schools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'org_admin' AND ur.organization_id = schools.organization_id)
        OR ur.role = 'super_admin'
      )
  )
);
