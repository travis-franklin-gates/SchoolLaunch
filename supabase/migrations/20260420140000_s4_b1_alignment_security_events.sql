-- Session 4 Track B1 (AUDIT 5.4): append-only audit log for prompt-injection
-- pattern matches against narratives uploaded to /api/alignment. Non-blocking:
-- the upload continues and the analysis runs, but we tag the response and
-- record an event so we can review incidents later. user_id may be null on
-- the rare edge case where the helper authenticated the request but the
-- narrative was otherwise rejected before insert.
CREATE TABLE IF NOT EXISTS public.alignment_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('injection_suspected')),
  patterns_matched text[] NOT NULL DEFAULT '{}',
  narrative_hash text,
  narrative_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alignment_security_events_school_created_idx
  ON public.alignment_security_events (school_id, created_at DESC);

ALTER TABLE public.alignment_security_events ENABLE ROW LEVEL SECURITY;

-- Read scope mirrors alignment_reviews: any user attached to the school
-- plus org_admin of the school's org plus super_admin.
DROP POLICY IF EXISTS alignment_security_events_select ON public.alignment_security_events;
CREATE POLICY alignment_security_events_select
  ON public.alignment_security_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND (
          ur.role = 'super_admin'
          OR ur.school_id = alignment_security_events.school_id
          OR (
            ur.role = 'org_admin'
            AND ur.organization_id = (SELECT organization_id FROM public.schools s WHERE s.id = alignment_security_events.school_id)
          )
        )
    )
  );

-- Writes are service-role only (route handler uses service client for insert).
-- No INSERT/UPDATE/DELETE policies → authenticated users cannot write directly.
