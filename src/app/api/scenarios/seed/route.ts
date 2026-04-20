import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { authenticateRequest } from '@/lib/apiAuth'
import { computeCarryForward } from '@/lib/budgetEngine'
import type { SchoolProfile } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { schoolId?: string } | null
  const schoolId = body?.schoolId
  if (!schoolId) return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })

  const auth = await authenticateRequest(request, {
    schoolId,
    requireRoles: ['school_ceo', 'school_editor', 'org_admin'],
  })
  if (auth instanceof NextResponse) return auth

  const admin = createServiceRoleClient()

  // Check if scenario engine scenarios already exist for this school
  const { data: existing } = await admin
    .from('scenarios')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('scenario_type', 'engine')

  if (existing && existing.length >= 3) {
    return NextResponse.json({ seeded: false, message: 'Scenarios already exist', scenarios: existing })
  }

  // Load school's base case data
  const { data: profile } = await admin
    .from('school_profiles')
    .select('*')
    .eq('school_id', schoolId)
    .single()

  if (!profile) return NextResponse.json({ error: 'School profile not found' }, { status: 404 })

  const { data: projections } = await admin
    .from('budget_projections')
    .select('*')
    .eq('school_id', schoolId)
    .eq('year', 1)

  // Get current facility cost from projections
  const facilityMonthly = Math.round(
    ((projections || []).find(p => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 180000) / 12
  )

  // Get carry-forward (startup capital baseline)
  const carryForward = computeCarryForward(profile as SchoolProfile)

  // Build three scenario defaults
  const scenarios = [
    {
      school_id: schoolId,
      name: 'Conservative',
      scenario_type: 'engine',
      is_base_case: false,
      assumptions: {
        enrollment_fill_rate: 0.80,
        per_pupil_funding_adjustment: -0.05,
        personnel_cost_adjustment: 0.05,
        facility_cost_monthly: Math.round(facilityMonthly * 1.10),
        startup_capital: Math.round(carryForward * 0.75),
      },
    },
    {
      school_id: schoolId,
      name: 'Base Case',
      scenario_type: 'engine',
      is_base_case: false,
      assumptions: {
        enrollment_fill_rate: 0.90,
        per_pupil_funding_adjustment: 0.0,
        personnel_cost_adjustment: 0.0,
        facility_cost_monthly: facilityMonthly,
        startup_capital: carryForward,
      },
    },
    {
      school_id: schoolId,
      name: 'Optimistic',
      scenario_type: 'engine',
      is_base_case: false,
      assumptions: {
        enrollment_fill_rate: 0.95,
        per_pupil_funding_adjustment: 0.0,
        personnel_cost_adjustment: -0.03,
        facility_cost_monthly: Math.round(facilityMonthly * 0.95),
        startup_capital: Math.round(carryForward * 1.25),
      },
    },
  ]

  const { data: inserted, error } = await admin
    .from('scenarios')
    .insert(scenarios)
    .select('id, name, assumptions')

  if (error) {
    return NextResponse.json({ error: 'Failed to create scenarios', detail: error }, { status: 500 })
  }

  return NextResponse.json({ seeded: true, scenarios: inserted })
}
