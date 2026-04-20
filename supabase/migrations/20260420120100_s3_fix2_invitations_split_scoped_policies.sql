-- Session 3, Fix 2 (AUDIT 4.2): The ALL policy "invitation access" allowed any org member
-- (including school_viewer) to INSERT/UPDATE/DELETE invitations anywhere in their org.
-- Split into a SELECT policy (read-only visibility for own-org members) and a write policy
-- scoped to CEO-of-target-school / org_admin-of-target-org / super_admin.

DROP POLICY IF EXISTS "invitation access" ON public.invitations;

CREATE POLICY "invitations_select_own_org"
ON public.invitations
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND organization_id IS NOT NULL
  )
);

CREATE POLICY "invitations_write_ceo_or_admin"
ON public.invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'school_ceo' AND ur.school_id = invitations.school_id)
        OR (ur.role = 'org_admin' AND ur.organization_id = invitations.organization_id)
        OR ur.role = 'super_admin'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'school_ceo' AND ur.school_id = invitations.school_id)
        OR (ur.role = 'org_admin' AND ur.organization_id = invitations.organization_id)
        OR ur.role = 'super_admin'
      )
  )
);
