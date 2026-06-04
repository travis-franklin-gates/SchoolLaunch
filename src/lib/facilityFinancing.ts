// P-FIN-01 / P-FIN-02: facility depreciation + facility debt interest for owned/financed
// WA Charter facilities.
//
// One `facility_financing` JSONB object per school_profile holds BOTH the depreciation
// inputs (basis, useful_life) and the loan inputs (principal, interest_rate, term_years,
// start_year). basis and principal are INDEPENDENT even though they often coincide
// (Cedar Grove's $5.175M is both). Math lives here and is consumed by
// computeMultiYearDetailed so pages, the Scorecard, and the export stay pure readers
// (single source of truth - no stored pre-computed amounts that can drift).
//
// Depreciation is straight-line: basis / useful_life, constant each year of the asset's
// life. Interest replicates the WSCSC V11 model exactly: a standard MONTHLY
// fully-amortizing loan schedule (verified byte-exact against Cedar Grove's V11 - $257,016
// Y1 declining to $240,151 Y5). The annual figure is the sum of that year's 12 monthly
// interest charges on the declining principal balance.
//
// Default = absent/null => no depreciation, no interest => byte-identical to a lease
// school. The Generic/Private/Micro pathways never populate facility_financing, so they
// are untouched.

/** Raw shape as stored (all optional; tolerant of partial input). */
export interface FacilityFinancing {
  basis?: number          // depreciation cost basis ($)
  useful_life?: number    // depreciation useful life (years), default 30
  principal?: number      // loan principal ($)
  interest_rate?: number  // loan annual interest rate (percent, e.g. 5)
  term_years?: number     // loan amortization term (years), default 30
  start_year?: number     // projection year financing begins (1-5), default 1
}

/** Fully-resolved financing used by the engine. */
export interface NormalizedFacilityFinancing {
  basis: number
  usefulLife: number
  principal: number
  interestRate: number
  termYears: number
  startYear: number
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Read + normalize the facility_financing column value. Returns null when there is no
 * financing to model (non-object, or neither a positive basis nor a positive principal) -
 * the engine then folds in $0 and the school is byte-identical to a lease school.
 */
export function readFacilityFinancing(raw: unknown): NormalizedFacilityFinancing | null {
  if (raw == null || typeof raw !== 'object') return null
  const f = raw as FacilityFinancing
  const basis = Math.max(0, num(f.basis, 0))
  const principal = Math.max(0, num(f.principal, 0))
  if (basis <= 0 && principal <= 0) return null
  return {
    basis,
    usefulLife: Math.max(0, num(f.useful_life, 30)),
    principal,
    interestRate: Math.max(0, num(f.interest_rate, 0)),
    termYears: Math.max(0, num(f.term_years, 30)),
    startYear: Math.max(1, Math.round(num(f.start_year, 1))),
  }
}

/**
 * Straight-line depreciation for projection `year`. Zero before start_year, after the
 * asset's useful life, or when there is no basis. Constant (basis / useful_life) during
 * the asset's life.
 */
export function annualDepreciation(ff: NormalizedFacilityFinancing, year: number): number {
  if (ff.basis <= 0 || ff.usefulLife <= 0) return 0
  if (year < ff.startYear) return 0
  if (year > ff.startYear + ff.usefulLife - 1) return 0 // fully depreciated
  return Math.round(ff.basis / ff.usefulLife)
}

/**
 * Facility-loan interest for projection `year`, from a MONTHLY fully-amortizing schedule
 * (matches WSCSC V11 to the cent). Zero before start_year, after the loan term, or when
 * there is no loan / no rate. The annual value is the sum of the 12 monthly interest
 * charges on the declining balance for that loan-year.
 */
export function annualInterest(ff: NormalizedFacilityFinancing, year: number): number {
  if (ff.principal <= 0 || ff.interestRate <= 0 || ff.termYears <= 0) return 0
  if (year < ff.startYear) return 0
  const loanYear = year - ff.startYear + 1 // 1-based year within the amortization schedule
  if (loanYear > ff.termYears) return 0 // loan paid off
  const r = ff.interestRate / 100 / 12   // monthly rate
  const n = ff.termYears * 12            // total payments
  const payment = ff.principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
  const targetStart = (loanYear - 1) * 12
  const targetEnd = loanYear * 12
  let balance = ff.principal
  let yearInterest = 0
  for (let m = 0; m < targetEnd; m++) {
    const monthInterest = balance * r
    if (m >= targetStart) yearInterest += monthInterest
    balance -= payment - monthInterest
  }
  return Math.round(yearInterest)
}
