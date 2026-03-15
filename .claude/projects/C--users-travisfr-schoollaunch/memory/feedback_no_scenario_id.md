---
name: No scenario_id on budget_projections
description: The budget_projections table does not have a scenario_id column — do not filter by it
type: feedback
---

Do not add scenario_id filters to budget_projections queries. The table schema does not include a scenario_id column.

**Why:** I incorrectly assumed the column existed based on the onboarding code inserting scenario_id. The actual database schema doesn't have it — Supabase silently ignores unknown columns on insert.

**How to apply:** When querying budget_projections, only filter by school_id and year. Check the actual database schema rather than inferring columns from insert code.
