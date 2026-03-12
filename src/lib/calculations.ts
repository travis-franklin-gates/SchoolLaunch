const PER_PUPIL_RATE = 15000
const LEVY_EQUITY_RATE = 1500
const BENEFITS_RATE = 0.30
const AUTHORIZER_FEE_RATE = 0.03

export function calcRevenue(enrollment: number) {
  return enrollment * PER_PUPIL_RATE
}

export function calcLevyEquity(enrollment: number) {
  return enrollment * LEVY_EQUITY_RATE
}

export function calcTotalBaseRevenue(enrollment: number) {
  return calcRevenue(enrollment) + calcLevyEquity(enrollment)
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

export function calcBenefits(salary: number) {
  return Math.round(salary * BENEFITS_RATE)
}

export function calcAuthorizerFee(enrollment: number) {
  return Math.round(calcRevenue(enrollment) * AUTHORIZER_FEE_RATE)
}

export function calcSections(enrollment: number, classSize: number) {
  return Math.ceil(enrollment / classSize)
}

export function calcEnrollmentGrowth(base: number, rate: number, year: number) {
  return Math.round(base * Math.pow(1 + rate / 100, year - 1))
}

export { PER_PUPIL_RATE, LEVY_EQUITY_RATE, BENEFITS_RATE, AUTHORIZER_FEE_RATE }
