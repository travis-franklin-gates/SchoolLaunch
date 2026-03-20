-- Backfill missing Operations categories for existing schools.
-- Inserts $0 rows for any category not yet present so the Operations tab always renders them.

DO $$
DECLARE
  cat TEXT;
  cats TEXT[] := ARRAY[
    'Facilities',
    'Insurance',
    'Supplies & Materials',
    'Technology',
    'Curriculum & Materials',
    'Professional Development',
    'Food Service',
    'Transportation',
    'Contracted Services',
    'Marketing & Outreach',
    'Fundraising',
    'Authorizer Fee'
  ];
  sid UUID;
BEGIN
  -- For every school that has at least one budget_projections row (i.e. completed onboarding)
  FOR sid IN
    SELECT DISTINCT school_id
    FROM budget_projections
    WHERE year = 1 AND is_revenue = false AND category = 'Operations'
  LOOP
    FOREACH cat IN ARRAY cats
    LOOP
      -- Only insert if this school+year+subcategory doesn't already exist
      INSERT INTO budget_projections (school_id, year, category, subcategory, amount, is_revenue)
      SELECT sid, 1, 'Operations', cat, 0, false
      WHERE NOT EXISTS (
        SELECT 1 FROM budget_projections
        WHERE school_id = sid
          AND year = 1
          AND subcategory = cat
          AND is_revenue = false
      );
    END LOOP;
  END LOOP;
END $$;
