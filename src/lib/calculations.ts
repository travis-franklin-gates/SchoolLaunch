import type { FinancialAssumptions } from './types'
import { DEFAULT_ASSUMPTIONS } from './types'

// Re-export defaults for backward compatibility
const PER_PUPIL_RATE = DEFAULT_ASSUMPTIONS.regular_ed_per_pupil
const LEVY_EQUITY_RATE = DEFAULT_ASSUMPTIONS.levy_equity_per_student
const BENEFITS_RATE = DEFAULT_ASSUMPTIONS.benefits_load_pct / 100
const AUTHORIZER_FEE_RATE = DEFAULT_ASSUMPTIONS.authorizer_fee_pct / 100

// --- AAFTE helper ---
export function calcAAFTE(headcount: number, aaftePct: number = 95): number {
  return Math.floor(headcount * aaftePct / 100)
}

// --- Commission-aligned revenue lines ---

/** Regular Ed apportionment: AAFTE × rate */
export function calcRegularEdRevenue(headcount: number, regularEdRate: number, aaftePct: number = 95): number {
  return calcAAFTE(headcount, aaftePct) * regularEdRate
}

/** SPED apportionment: AAFTE × SPED% × SPED rate */
export function calcSpedRevenue(headcount: number, pctIep: number, spedRate: number, aaftePct: number = 95): number {
  return Math.round(calcAAFTE(headcount, aaftePct) * (pctIep / 100) * spedRate)
}

/** Facilities revenue: AAFTE × rate (usually $0 for WA charters) */
export function calcFacilitiesRevenue(headcount: number, facilitiesRate: number, aaftePct: number = 95): number {
  return calcAAFTE(headcount, aaftePct) * facilitiesRate
}

/** Levy equity: AAFTE × rate */
export function calcLevyEquityCommission(headcount: number, levyRate: number, aaftePct: number = 95): number {
  return calcAAFTE(headcount, aaftePct) * levyRate
}

// --- Legacy revenue functions (still used in some code paths) ---

export function calcRevenue(enrollment: number, perPupilRate: number = PER_PUPIL_RATE) {
  return enrollment * perPupilRate
}

export function calcLevyEquity(enrollment: number, levyRate: number = LEVY_EQUITY_RATE) {
  return enrollment * levyRate
}

export function calcTotalBaseRevenue(enrollment: number, perPupilRate: number = PER_PUPIL_RATE, levyRate: number = LEVY_EQUITY_RATE) {
  return calcRevenue(enrollment, perPupilRate) + calcLevyEquity(enrollment, levyRate)
}

// --- Categorical grants (use headcount, not AAFTE) ---
// These functions accept per-pupil rates from assumptions and apply regionalization where appropriate.

export function calcTitleI(enrollment: number, pctFrl: number, rate: number = 880) {
  return pctFrl > 40 ? Math.round(enrollment * (pctFrl / 100) * rate) : 0
}

export function calcIDEA(enrollment: number, pctIep: number, rate: number = 2200) {
  return Math.round(enrollment * (pctIep / 100) * rate)
}

export function calcLAP(enrollment: number, pctFrl: number, rate: number = 690) {
  return Math.round(enrollment * (pctFrl / 100) * rate)
}

export function calcTBIP(enrollment: number, pctEll: number, rate: number = 1600) {
  return Math.round(enrollment * (pctEll / 100) * rate)
}

export function calcHiCap(enrollment: number, pctHicap: number, rate: number = 625) {
  return Math.round(enrollment * (pctHicap / 100) * rate)
}

export function calcAllGrants(enrollment: number, pctFrl: number, pctIep: number, pctEll: number, pctHicap: number, assumptions?: FinancialAssumptions) {
  const a = assumptions || DEFAULT_ASSUMPTIONS
  const regionFactor = a.regionalization_factor || 1.0
  return {
    titleI: calcTitleI(enrollment, pctFrl, a.title_i_per_pupil),
    idea: calcIDEA(enrollment, pctIep, a.idea_per_pupil),
    lap: calcLAP(enrollment, pctFrl, Math.round(a.lap_per_pupil * regionFactor)),
    tbip: calcTBIP(enrollment, pctEll, Math.round(a.tbip_per_pupil * regionFactor)),
    hicap: calcHiCap(enrollment, pctHicap, Math.round(a.hicap_per_pupil * regionFactor)),
  }
}

// --- Commission-aligned total revenue (12 lines) ---

export interface CommissionRevenue {
  regularEd: number
  sped: number
  facilitiesRev: number
  levyEquity: number
  titleI: number
  idea: number
  lap: number
  tbip: number
  hicap: number
  total: number
  aafte: number
  headcount: number
}

export function calcCommissionRevenue(
  headcount: number,
  pctFrl: number,
  pctIep: number,
  pctEll: number,
  pctHicap: number,
  assumptions: FinancialAssumptions,
  colaYear: number = 1,
): CommissionRevenue {
  const colaMult = Math.pow(1 + assumptions.revenue_cola_pct / 100, colaYear - 1)
  const regionFactor = assumptions.regionalization_factor || 1.0

  // State rates: base × regionalization × COLA
  const regRate = Math.round(assumptions.regular_ed_per_pupil * regionFactor * colaMult)
  const spedRate = Math.round(assumptions.sped_per_pupil * regionFactor * colaMult)
  const facRate = Math.round(assumptions.facilities_per_pupil * colaMult) // facilities not regionalized
  const levyRate = Math.round(assumptions.levy_equity_per_student * colaMult) // levy not regionalized
  const aaftePct = assumptions.aafte_pct

  const aafte = calcAAFTE(headcount, aaftePct)

  // State & Local (AAFTE-based)
  const regularEd = aafte * regRate
  const sped = Math.round(aafte * (pctIep / 100) * spedRate)
  const facilitiesRev = aafte * facRate
  const levyEquity = aafte * levyRate

  // State categorical (headcount-based) — regionalized + COLA
  const lapRate = Math.round((assumptions.lap_per_pupil || 690) * regionFactor * colaMult)
  const tbipRate = Math.round((assumptions.tbip_per_pupil || 1600) * regionFactor * colaMult)
  const hicapRate = Math.round((assumptions.hicap_per_pupil || 625) * regionFactor * colaMult)
  const lap = Math.round(headcount * (pctFrl / 100) * lapRate)
  const tbip = Math.round(headcount * (pctEll / 100) * tbipRate)
  const hicap = Math.round(headcount * (pctHicap / 100) * hicapRate)

  // Federal (headcount-based) — NOT regionalized, just COLA
  const titleIRate = Math.round((assumptions.title_i_per_pupil || 880) * colaMult)
  const ideaRate = Math.round((assumptions.idea_per_pupil || 2200) * colaMult)
  const titleI = pctFrl > 40 ? Math.round(headcount * (pctFrl / 100) * titleIRate) : 0
  const idea = Math.round(headcount * (pctIep / 100) * ideaRate)

  const total = regularEd + sped + facilitiesRev + levyEquity + titleI + idea + lap + tbip + hicap

  return { regularEd, sped, facilitiesRev, levyEquity, titleI, idea, lap, tbip, hicap, total, aafte, headcount }
}

// --- Benefits ---

export function calcBenefits(salary: number, benefitsRate: number = BENEFITS_RATE) {
  return Math.round(salary * benefitsRate)
}

// --- Authorizer fee (3% of state apportionment = regularEd + sped + facilitiesRev) ---

export function calcAuthorizerFee(enrollment: number, feeRate: number = AUTHORIZER_FEE_RATE, perPupilRate: number = PER_PUPIL_RATE) {
  return Math.round(calcRevenue(enrollment, perPupilRate) * feeRate)
}

export function calcAuthorizerFeeCommission(stateApportionment: number, feeRate: number = AUTHORIZER_FEE_RATE): number {
  return Math.round(stateApportionment * feeRate)
}

// --- Sections & enrollment growth ---

export function calcSections(enrollment: number, classSize: number) {
  return Math.ceil(enrollment / classSize)
}

export function calcEnrollmentGrowth(base: number, rate: number, year: number) {
  return Math.round(base * Math.pow(1 + rate / 100, year - 1))
}

// --- Legacy total revenue ---

export function calcTotalRevenue(
  enrollment: number,
  pctFrl: number,
  pctIep: number,
  pctEll: number,
  pctHicap: number,
  assumptions: FinancialAssumptions
) {
  const rev = calcCommissionRevenue(enrollment, pctFrl, pctIep, pctEll, pctHicap, assumptions)
  return rev.total
}

export { PER_PUPIL_RATE, LEVY_EQUITY_RATE, BENEFITS_RATE, AUTHORIZER_FEE_RATE }
