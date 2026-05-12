# ESWA Notice — Enrollment Modeling Update (R-ENR-01)

**Status:** DRAFT — Travis review required before sending.
**Date:** 2026-05-11
**From:** Travis Franklin
**To:** ESWA staff (TBD recipients)
**Subject suggestion:** SchoolLaunch enrollment modeling update — heads-up for your portfolio reviews

---

Hi team,

A quick heads-up on a SchoolLaunch update that landed today. The short version: **multi-year enrollment modeling now reflects realistic year-over-year attrition, and the AI advisory output now accurately describes what the math does.** The update lands cleanly across every WA charter school currently in SchoolLaunch — no school had submitted a Commission plan that included the prior modeling, so no submission was affected.

## What changed

Multi-year enrollment projections (Year 2 onward) now apply an annual retention rate to continuing-grade students, while new-grade-level additions enroll at full planned capacity. The default is 92% retention, calibrated against the 90–95% range typical of WA charter elementary schools. Each school CEO can adjust via a new slider in Settings → Grade Expansion (range 70–100%, with a tooltip explaining the math).

The previous behavior projected Year 2+ enrollment at full planned capacity with implicit 100% retention. That model overstated enrollment in years where the school was no longer adding new grades.

## Why this matters for ESWA

Two pieces of context worth flagging:

1. **The AI advisory features were describing attrition modeling that wasn't reflected in the underlying calculations.** If you've been relaying AI-generated guidance to school CEOs — Commission Reviewer notes, Enrollment Realist findings, Staffing Advisor recommendations — the prose may have referenced attrition or retention modeling that the projections didn't actually support. The fix corrects both the math and the AI's description of it. Schools' AI briefings will regenerate on next dashboard visit with the corrected framing.

2. **No school's submitted plan was affected.** Every school in SchoolLaunch is still in planning status; nothing has gone to the Commission yet under the previous modeling. The fix lands before any external review is impacted.

## What founders will see

Starting with their next dashboard visit, schools with the default retention applied (92%) will see:

- **Year 1 numbers unchanged.** Founding-year enrollment doesn't depend on retention.
- **Year 2 through Year 5 enrollment slightly lower** than before, especially in the final buildout year (where retention applies but no new grades are added to offset it).
- **Downstream metrics adjust:** Reserve Days, Personnel %, Days Cash on Hand, FPF Scorecard outcomes, scenario projections.
- **AI briefings regenerate** with corrected framing and the new numbers.

For a K-2 founding → K-5 buildout school with 1×24 sections, the trajectory shifts roughly from `[72, 96, 120, 144, 144]` to `[72, 90, 107, 122, 112]` under 92% retention.

## What doesn't change

- **Year 1 enrollment** is identical.
- **Schools' retention rate, once stored, is preserved.** Founders who had explicitly set a retention value (e.g., test schools at 90%) keep it. The migration only adjusted the silent 100% default.
- **The Settings slider lets each CEO adjust** to match their school's expected attrition profile — neighborhood mobility, programmatic differentiation, family commitment.

## Suggested language for ESWA staff reviewing draft plans

When you next review a school CEO's draft financial plan, you might say:

> "SchoolLaunch updated its multi-year enrollment modeling to apply realistic annual student retention. The default is 92%, which sits in the typical 90–95% WA charter elementary range. Take a look at the new slider in Settings → Grade Expansion and confirm the assumption matches what you'd defend to a Commission reviewer. If your school's context suggests something different — higher mobility, a new-school waitlist depth question, programmatic factors — adjust the slider and the projections recalculate automatically."

For schools whose draft plans you've already reviewed under the prior modeling: a quick recheck of Years 2–5 and the Commission FPF Scorecard is worth doing before the next iteration. Commission reviewers will scrutinize enrollment realism in interviews; the corrected model is more credible than the prior one.

## Questions

Reach out directly if you want me to walk through the modeling change on a specific school, or if you'd like me to demo the slider for ESWA's review workflow.

Thanks for everything you do.

Travis

---

**Draft notes (Travis review):**
- Reviewer should confirm: tone, framing, the "no submission affected" line (positive framing), the F3 disclosure paragraph (honest without burying).
- The illustrative trajectory `[72, 90, 107, 122, 112]` uses Evergreen Heights' audit school as the example. Could swap for a more generic example if preferred (or remove the bracket numbers if too technical).
- ESWA staff suggested-language section is meant as copy-paste-able. Reviewer should confirm the phrasing matches ESWA's voice.
- No code/file/function references included per spec.
- No `submitted` / `under_review` references — the schema only has planning/authorized/exported, and the framing is "no school has shipped a plan yet" which is the strongest possible position.

**STOP — Awaiting Travis review and edits before send.**
