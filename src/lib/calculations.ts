import type { FinancialAssumptions } from './types'
import { DEFAULT_ASSUMPTIONS } from './types'

// Re-export defaults for backward compatibility
const PER_PUPIL_RATE = DEFAULT_ASSUMPTIONS.per_pupil_rate
const LEVY_EQUITY_RATE = DEFAULT_ASSUMPTIONS.levy_equity_per_student
const BENEFITS_RATE = DEFAULT_ASSUMPTIONS.benefits_load_pct / 100
const AUTHORIZER_FEE_RATE = DEFAULT_ASSUMPTIONS.authorizer_fee_pct / 100

export function calcRevenue(enrollment: number, perPupilRate: number = PER_PUPIL_RATE) {
  return enrollment * perPupilRate
}

export function calcLevyEquity(enrollment: number, levyRate: number = LEVY_EQUITY_RATE) {
  return enrollment * levyRate
}

export function calcTotalBaseRevenue(enrollment: number, perPupilRate: number = PER_PUPIL_RATE, levyRate: number = LEVY_EQUITY_RATE) {
  return calcRevenue(enrollment, perPupilRate) + calcLevyEquity(enrollment, levyRate)
}

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

export function calcBenefits(salary: number, benefitsRate: number = BENEFITS_RATE) {
  return Math.round(salary * benefitsRate)
}

export function calcAuthorizerFee(enrollment: number, feeRate: number = AUTHORIZER_FEE_RATE, perPupilRate: number = PER_PUPIL_RATE) {
  return Math.round(calcRevenue(enrollment, perPupilRate) * feeRate)
}

export function calcSections(enrollment: number, classSize: number) {
  return Math.ceil(enrollment / classSize)
}

export function calcEnrollmentGrowth(base: number, rate: number, year: number) {
  return Math.round(base * Math.pow(1 + rate / 100, year - 1))
}

export function calcTotalRevenue(
  enrollment: number,
  pctFrl: number,
  pctIep: number,
  pctEll: number,
  pctHicap: number,
  assumptions: FinancialAssumptions
) {
  const apportionment = calcRevenue(enrollment, assumptions.per_pupil_rate)
  const levyEquity = calcLevyEquity(enrollment, assumptions.levy_equity_per_student)
  const grants = calcAllGrants(enrollment, pctFrl, pctIep, pctEll, pctHicap)
  return apportionment + levyEquity + grants.titleI + grants.idea + grants.lap + grants.tbip + grants.hicap
}

export { PER_PUPIL_RATE, LEVY_EQUITY_RATE, BENEFITS_RATE, AUTHORIZER_FEE_RATE }
