/**
 * Centralized health-threshold logic for WA charter financial planning.
 *
 * Single source of truth for dashboard tiles, AI agent prompts, UI copy, and
 * exports that need to evaluate whether a school's metrics fall within healthy,
 * approaching, or failing bands.
 *
 * SCOPE NOTE (R-HEALTH-01 follow-up): This file currently exports only
 * `evaluatePersonnelPctHealth`. Extending the same pattern to Days of Cash,
 * Total Margin, Current Ratio, and Enrollment Variance is queued as
 * R-HEALTH-01 in BACKLOG.md.
 *
 * REPRESENTATION NOTE: All percentages are INTEGER PERCENTAGES (65, 72, 78),
 * NOT decimal fractions (0.65, 0.72, 0.78). Producers and consumers must use
 * the same representation; mixing them silently produces wrong evaluations.
 */

export type HealthVerdict = 'meets' | 'approaching' | 'fails'

export interface PersonnelHealthBand {
  /** Inclusive lower bound of the "meets" band. */
  meetsLower: number
  /** Inclusive upper bound of the "meets" band. */
  meetsUpper: number
  /** Inclusive lower bound of "approaching" — values in [approachingLow, meetsLower) are "approaching low". */
  approachingLow: number
  /** Inclusive upper bound of "approaching" — values in (meetsUpper, approachingHigh] are "approaching high". */
  approachingHigh: number
  /** Short human-readable label for the band, e.g. "Founding year 65–72%". */
  label: string
  /** Year category, useful for prompts and tooltips. */
  yearCategory: 'founding' | 'steady_state'
}

export interface PersonnelHealthEvaluation {
  verdict: HealthVerdict
  band: PersonnelHealthBand
  /** Tile-friendly short string, e.g. "Within founding-year range" or "Below healthy range". */
  short: string
  /** Full sentence for tooltips and AI prompts — explains the verdict against the band. */
  long: string
}

/**
 * Return the personnel-% band that applies for a given operating year.
 *
 * Two-band model (F-001/F-011 Phase 1 decision D1):
 *   - Year 1 (founding):     meets 65–72%, approaching 62–65% or 72–75%, fails outside
 *   - Year 2+ (steady-state): meets 72–78%, approaching 69–72% or 78–81%, fails outside
 *
 * Y2 transition handled naturally by enrollment growth (per D1 decision).
 */
export function getPersonnelHealthBand(year: number): PersonnelHealthBand {
  if (year === 1) {
    return {
      meetsLower: 65,
      meetsUpper: 72,
      approachingLow: 62,
      approachingHigh: 75,
      label: 'Founding year 65–72%',
      yearCategory: 'founding',
    }
  }
  return {
    meetsLower: 72,
    meetsUpper: 78,
    approachingLow: 69,
    approachingHigh: 81,
    label: 'Steady-state 72–78%',
    yearCategory: 'steady_state',
  }
}

/**
 * Evaluate a personnel-as-share-of-operating-revenue percentage against the
 * year-appropriate healthy band.
 *
 * @param pct - Personnel % of operating revenue, as integer percentage (e.g. 65.3 not 0.653)
 * @param year - Operating year (1 = founding, 2+ = steady-state)
 */
export function evaluatePersonnelPctHealth(pct: number, year: number): PersonnelHealthEvaluation {
  const band = getPersonnelHealthBand(year)
  const formatted = pct.toFixed(1)

  let verdict: HealthVerdict
  let short: string
  let long: string

  if (pct >= band.meetsLower && pct <= band.meetsUpper) {
    verdict = 'meets'
    short = `Within ${band.yearCategory === 'founding' ? 'founding-year' : 'steady-state'} range`
    long = `Personnel costs at ${formatted}% of operating revenue are within the healthy ${band.label.toLowerCase()} range for WA charter schools.`
  } else if (pct >= band.approachingLow && pct < band.meetsLower) {
    verdict = 'approaching'
    short = 'Approaching low'
    long = `Personnel costs at ${formatted}% are just below the healthy ${band.label.toLowerCase()} range. Review staffing plan against academic program commitments to confirm adequate coverage.`
  } else if (pct > band.meetsUpper && pct <= band.approachingHigh) {
    verdict = 'approaching'
    short = 'Approaching high'
    long = `Personnel costs at ${formatted}% are just above the healthy ${band.label.toLowerCase()} range. Monitor sustainability — there's limited margin to absorb shocks if enrollment doesn't grow.`
  } else if (pct < band.approachingLow) {
    verdict = 'fails'
    short = 'Below healthy range'
    long = `Personnel costs at ${formatted}% are significantly below the healthy ${band.label.toLowerCase()} range. The school is likely under-staffed for delivering quality programming and will face authorizer scrutiny over academic capacity.`
  } else {
    // pct > approachingHigh
    verdict = 'fails'
    short = 'Above healthy range'
    long = `Personnel costs at ${formatted}% are significantly above the healthy ${band.label.toLowerCase()} range. Insufficient margin to absorb enrollment fluctuations, mid-year hires, or benefit cost increases. Plan reviewers will scrutinize staffing decisions at this level.`
  }

  return { verdict, band, short, long }
}

/**
 * Render the personnel-% band definitions as a single prompt-ready string,
 * for injection into AI agent system prompts (Staffing Advisor, Ask SchoolLaunch).
 *
 * Single source of truth ensures the prompts never drift from the helper's
 * verdict logic — the R-ENR-01 F3 lesson.
 */
export function personnelHealthBandsForPrompt(): string {
  const y1 = getPersonnelHealthBand(1)
  const yN = getPersonnelHealthBand(2)
  return [
    `PERSONNEL % HEALTH BANDS (year-aware):`,
    `- Year 1 (founding): healthy ${y1.meetsLower}–${y1.meetsUpper}%, approaching ${y1.approachingLow}–${y1.meetsLower}% (low) or ${y1.meetsUpper}–${y1.approachingHigh}% (high). Below ${y1.approachingLow}% = under-staffed; above ${y1.approachingHigh}% = unsustainable.`,
    `- Year 2+ (steady-state): healthy ${yN.meetsLower}–${yN.meetsUpper}%, approaching ${yN.approachingLow}–${yN.meetsLower}% (low) or ${yN.meetsUpper}–${yN.approachingHigh}% (high). Below ${yN.approachingLow}% = under-staffed; above ${yN.approachingHigh}% = unsustainable.`,
    `- Apply the correct band for each year — DO NOT cite the steady-state 72–78% range as the standard for Year 1 founding schools. Founding schools genuinely run leaner because staffing is sized to current enrollment, not buildout capacity.`,
  ].join('\n')
}
