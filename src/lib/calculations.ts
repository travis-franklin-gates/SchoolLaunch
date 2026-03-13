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

export function calcTitleI(enrollment: number, pctFrl: number) {
  return pctFrl > 40 ? Math.round(enrollment * (pctFrl / 100) * 880) : 0
}

export function calcIDEA(enrollment: number, pctIep: number) {
  return Math.round(enrollment * (pctIep / 100) * 2200)
}

export function calcLAP(enrollment: number, pctFrl: number) {
  return Math.round(enrollment * (pctFrl / 100) * 400)
}

export function calcTBIP(enrollment: number, pctEll: number) {
  return Math.round(enrollment * (pctEll / 100) * 1800)
}

export function calcHiCap(enrollment: number, pctHicap: number) {
  return Math.round(enrollment * (pctHicap / 100) * 500)
}

export function calcAllGrants(enrollment: number, pctFrl: number, pctIep: number, pctEll: number, pctHicap: number) {
  return {
    titleI: calcTitleI(enrollment, pctFrl),
    idea: calcIDEA(enrollment, pctIep),
    lap: calcLAP(enrollment, pctFrl),
    tbip: calcTBIP(enrollment, pctEll),
    hicap: calcHiCap(enrollment, pctHicap),
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
  const regRate = Math.round(assumptions.regular_ed_per_pupil * colaMult)
  const spedRate = Math.round(assumptions.sped_per_pupil * colaMult)
  const facRate = Math.round(assumptions.facilities_per_pupil * colaMult)
  const levyRate = Math.round(assumptions.levy_equity_per_student * colaMult)
  const aaftePct = assumptions.aafte_pct

  const aafte = calcAAFTE(headcount, aaftePct)

  // State & Local (AAFTE-based)
  const regularEd = aafte * regRate
  const sped = Math.round(aafte * (pctIep / 100) * spedRate)
  const facilitiesRev = aafte * facRate
  const levyEquity = aafte * levyRate

  // Federal & categorical (headcount-based) — rates also get COLA
  const titleI = pctFrl > 40 ? Math.round(headcount * (pctFrl / 100) * Math.round(880 * colaMult)) : 0
  const idea = Math.round(headcount * (pctIep / 100) * Math.round(2200 * colaMult))
  const lap = Math.round(headcount * (pctFrl / 100) * Math.round(400 * colaMult))
  const tbip = Math.round(headcount * (pctEll / 100) * Math.round(1800 * colaMult))
  const hicap = Math.round(headcount * (pctHicap / 100) * Math.round(500 * colaMult))

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
