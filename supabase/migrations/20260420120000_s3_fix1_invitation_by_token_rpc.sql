-- Session 3, Fix 1 (AUDIT 4.1): Remove anonymous SELECT * access on invitations.
-- Replace with a SECURITY DEFINER RPC that enforces token match + not-accepted + not-expired
-- at the database level, and returns at most one row. Token column intentionally omitted
-- from the return shape — the caller already has the token.

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  school_id uuid,
  organization_id uuid,
  ceo_name text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, role, school_id, organization_id, ceo_name, expires_at
  FROM public.invitations
  WHERE token = p_token
    AND accepted = false
    AND expires_at > now()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "public can read invitation by token" ON public.invitations;
