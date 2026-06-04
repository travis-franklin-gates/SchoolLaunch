# R-REV-07 build-check + 39-name picklist checkpoint

Status: Phase 0 verification + name-list checkpoint. No product code yet. Stop for
approval of the seed list before Phase 1.

## V1 - Expense splice point + pct_revenue ordering

- Non-personnel totals roll up at budgetEngine.ts: totalOperations (line 668) ->
  totalExpenses = totalPersonnel + totalOperations (670) -> net (698). Custom expense
  must fold into totalOperations before 670.
- pct_revenue slot = the authorizerFee position (line 658, post-revenue, pre-totals).
- ORDERING REFINEMENT (consistent with the locked design, not a contradiction): the
  R-REV-03 custom-REVENUE fold currently sits AFTER totalExpenses (lines 672-696), so
  operatingRevenue-including-custom-recurring is finalized too late for a pct_revenue
  expense to read it. Phase 1 must MOVE the custom-revenue fold to before the ops block
  (right after totalPersonnel ~649, where positionsForYear/fteForYear are known). This
  is byte-identical for R-REV-03 (custom revenue amounts depend only on enrollment/fte/
  cola, not on expenses), and it makes operatingRevenue the finalized recurring revenue
  base for pct_revenue. Then: ops block -> custom-expense fold (ratio drivers +
  pct_revenue using operatingRevenue) -> add into totalOperations -> totalExpenses.
  Custom expense will be added to totalOperations AFTER contingency (not in the
  contingency base), so contingency stays byte-identical when there are no custom lines.

## V2 - Export expense block

- P&L NON-PERSONNEL EXPENSES rows: route.ts lines 326-340 (Facilities .. Contingency),
  then 'Total Non-Personnel' (340). Insert itemized custom-expense rows under their
  group header before line 340, iterating row.operations.customExpense[]. Pure reader.

## V3 - FPF

- Confirmed automatic: computeFPFScorecard reads row.totalExpenses for Days of Cash
  (numerator side via dailyExpense) and Current Ratio (totalExpenses/12), and row.net.
  Folding custom expense into totalOperations -> totalExpenses reaches all three with no
  scorecard change.

## V4 - The V11 non-personnel expense names (from session2/v11_values.json)

V11 itemizes 39 non-personnel sub-lines across 3 groups. CRITICAL (3121 lesson): many
duplicate an existing first-class SchoolLaunch ops line, and several are computed or
out-of-scope. Proposed handling per line below. EXCLUDE = do not seed (double-count or
out-of-scope). OVERLAP = duplicates an existing SL line; itemization-only - seeding is
fine but the founder must zero the parent SL line or it double-counts (flag in UI copy).
NEW = no existing SL equivalent, safe to seed.

### Contracted Services (V11: 9)
| V11 line | Driver | Status |
|---|---|---|
| Accounting / Audit | flat | NEW |
| Legal | flat | NEW |
| Management Company Fee | pct_revenue | NEW (the fifth-driver line) |
| Payroll Services | per_fte | NEW |
| Nurse Services | flat | NEW |
| Special Ed Services | flat | NEW |
| Titlement Services | flat | NEW |
| All Other Contracted Services | flat | NEW |
| Oversight Fee (3% of state revenue) | - | EXCLUDE - this IS the authorizer fee, already computed in SL and non-editable; seeding guarantees double-count |

### School Operations (V11: 22)
| V11 line | Driver | Status |
|---|---|---|
| Board Expenses | flat | NEW |
| Classroom/Teaching Supplies | per_pupil | OVERLAP (SL 'Supplies & Materials') |
| Special Ed Supplies | per_pupil | NEW |
| Textbooks/Workbooks | per_pupil | OVERLAP (SL 'Curriculum & Materials') |
| Supplies & Materials Other | per_pupil | OVERLAP (SL 'Supplies & Materials') |
| School Ops Equipment/Furniture | flat | NEW |
| Telephone | flat | NEW |
| Technology | per_pupil | OVERLAP (SL 'Technology') |
| Student Testing & Assessment | per_pupil | NEW |
| Field Trips | per_pupil | NEW |
| Transportation (Student) | per_pupil | OVERLAP (SL 'Transportation') |
| Student Services Other | flat | NEW |
| Office Expense | flat | NEW |
| Staff Development | per_fte | OVERLAP (SL 'Professional Development') |
| Staff Recruitment | flat | NEW |
| Student Recruitment/Marketing | per_pupil | OVERLAP (SL 'Marketing & Outreach') |
| School Meals/Lunch | per_pupil | OVERLAP (SL 'Food Service') |
| Stipends/Bonuses | per_fte | NEW |
| Fundraising (expense) | flat | OVERLAP (SL 'Fundraising') |
| Extra Curricular | per_pupil | NEW |
| Misc. Operating Expenses | flat | NEW |
| All Other School Operations | flat | NEW |

### Facility O&M (V11: 8)
| V11 line | Driver | Status |
|---|---|---|
| Insurance | inflation | OVERLAP (SL 'Insurance') |
| Janitorial Services | inflation | NEW |
| Building and Land Rent/Lease | inflation | OVERLAP (SL 'Facilities') |
| Repairs & Maintenance | inflation | NEW |
| Facility Equipment/Furniture | flat | NEW |
| Security Services | inflation | NEW |
| Utilities | per_pupil | NEW |
| All Other Facilities | flat | NEW |

### Out of scope / not non-personnel (NOT in the picklist)
- Reserves/Contingency - SL computes contingency (2% of expenses); EXCLUDE (double-count).
- Interest Expense, Depreciation & Amortization - P-FIN-01 / P-FIN-02 (facility-debt
  model); EXCLUDE (separate backlog, not line itemization).
- Personnel Services Costs (echo), Personnel Taxes & Benefits (echo) - PERSONNEL, modeled
  by the staffing engine; EXCLUDE.

## Proposed seed picklist (recommendation)

Seed the NEW + OVERLAP lines (37 total: 8 Contracted + 21 School Ops + 8 Facility), each
with the driver above. EXCLUDE the 4 computed/out-of-scope/echo lines (Oversight Fee,
Reserves/Contingency, Interest, Depreciation, + 2 personnel echoes). For OVERLAP lines,
the editor will carry a short note: "Duplicates the built-in <X> line - zero that line if
you itemize here, to avoid double-counting." 

OPEN QUESTIONS for your approval:
1. Seed all 37 (NEW + OVERLAP), or NEW-only (exclude the 10 OVERLAP duplicates to remove
   double-count risk entirely, at the cost of not itemizing those categories)?
2. Confirm Oversight Fee / Contingency / Interest / Depreciation / personnel echoes stay
   EXCLUDED.
3. Confirm the driver assignments (especially Management Company Fee = pct_revenue;
   Stipends/Payroll/Staff Development = per_fte).
