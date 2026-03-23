import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { computeScenarioProjections, type ScenarioAssumptions } from '@/lib/scenarioEngine'
import { computeAdvisoryHash } from '@/lib/buildSchoolContext'
import type { SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry } from '@/lib/types'

export async function POST(request: Request) {
  const { schoolId, scenarioId } = await request.json()
  if (!schoolId) return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceRoleClient()

  // Load all engine scenarios for this school (or just one if scenarioId provided)
  let scenarioQuery = admin
    .from('scenarios')
    .select('id, name, assumptions')
    .eq('school_id', schoolId)
    .eq('scenario_type', 'engine')

  if (scenarioId) {
    scenarioQuery = scenarioQuery.eq('id', scenarioId)
  }

  const { data: scenarios, error: scenError } = await scenarioQuery
  if (scenError || !scenarios || scenarios.length === 0) {
    return NextResponse.json({ error: 'No scenarios found' }, { status: 404 })
  }

  // Load school's base case data
  const [profileRes, posRes, projRes, gepRes] = await Promise.all([
    admin.from('school_profiles').select('*').eq('school_id', schoolId).single(),
    admin.from('staffing_positions').select('*').eq('school_id', schoolId).order('year'),
    admin.from('budget_projections').select('*').eq('school_id', schoolId).eq('year', 1),
    admin.from('grade_expansion_plan').select('*').eq('school_id', schoolId).order('year').order('grade_level'),
  ])

  const profile = profileRes.data as SchoolProfile
  if (!profile) return NextResponse.json({ error: 'School profile not found' }, { status: 404 })

  const allPositions = (posRes.data || []) as StaffingPosition[]
  const positions = allPositions.filter(p => p.year === 1)
  const projections = (projRes.data || []) as BudgetProjection[]
  const gradeExpansionPlan = (gepRes.data || []) as GradeExpansionEntry[]

  // Compute base data hash for staleness detection
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const totalPersonnel = positions.reduce((s, p) => s + p.fte * p.annual_salary, 0)
  const totalOps = projections.filter(p => !p.is_revenue).reduce((s, p) => s + p.amount, 0)
  const baseHash = computeAdvisoryHash(
    profile.target_enrollment_y1 * 12000, // approximate revenue for hash
    totalPersonnel,
    totalOps,
    profile.target_enrollment_y1,
    totalFte
  )

  // Calculate each scenario
  const results: Array<{ id: string; name: string; results: unknown }> = []

  for (const scenario of scenarios) {
    const levers = scenario.assumptions as ScenarioAssumptions
    const { results: scenarioResults } = computeScenarioProjections(
      profile,
      positions,
      allPositions,
      projections,
      gradeExpansionPlan,
      levers,
    )

    // Save results to database
    await admin
      .from('scenarios')
      .update({
        results: scenarioResults,
        base_data_hash: baseHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scenario.id)

    results.push({
      id: scenario.id,
      name: scenario.name,
      results: scenarioResults,
    })
  }

  return NextResponse.json({ success: true, scenarios: results, baseHash })
}
