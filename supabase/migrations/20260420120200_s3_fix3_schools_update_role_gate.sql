-- Session 3, Fix 3 (AUDIT 4.3): The "school ceos update own school" UPDATE policy matched any
-- user with a row in user_roles for that school_id — so school_editor and school_viewer could
-- also UPDATE schools (e.g., rename). Role-gate to school_ceo of that school, org_admin of that
-- org, or super_admin. Keep the policy name stable-ish but make its role filter explicit.

DROP POLICY IF EXISTS "school ceos update own school" ON public.schools;

CREATE POLICY "schools_update_ceo_or_admin"
ON public.schools
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'school_ceo' AND ur.school_id = schools.id)
        OR (ur.role = 'org_admin' AND ur.organization_id = schools.organization_id)
        OR ur.role = 'super_admin'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'school_ceo' AND ur.school_id = schools.id)
        OR (ur.role = 'org_admin' AND ur.organization_id = schools.organization_id)
        OR ur.role = 'super_admin'
      )
  )
);
