import { Fragment } from 'react'

export interface StepperStep {
  label: string
}

export interface StepperProps {
  steps: StepperStep[]
  /**
   * Zero-indexed current step. -1 indicates a pre-step screen (welcome) where
   * no step is active and all are upcoming.
   */
  currentIndex: number
}

/**
 * Numbered horizontal stepper. md+: numbered circles with labels and
 * connector bars. <md: collapses to "Step N of M" text.
 */
export function OnboardingStepper({ steps, currentIndex }: StepperProps) {
  const total = steps.length
  const safeCurrent = currentIndex < 0 ? -1 : Math.min(currentIndex, total - 1)
  const progressPct = safeCurrent < 0
    ? 0
    : ((safeCurrent + 1) / total) * 100

  return (
    <nav aria-label="Onboarding progress" className="mb-8 max-w-3xl mx-auto">
      {/* Mobile: compact step indicator */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700" style={{ fontFamily: 'var(--font-heading-var)' }}>
            {safeCurrent < 0 ? 'Get started' : steps[safeCurrent]?.label}
          </span>
          <span className="text-xs text-slate-500">
            {safeCurrent < 0 ? `${total} steps` : `Step ${safeCurrent + 1} of ${total}`}
          </span>
        </div>
        <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%`, background: 'var(--navy-dark)' }}
          />
        </div>
      </div>

      {/* Desktop: numbered horizontal stepper */}
      <ol className="hidden md:flex items-start" role="list">
        {steps.map((step, i) => {
          const state: 'completed' | 'current' | 'upcoming' =
            i < safeCurrent ? 'completed' : i === safeCurrent ? 'current' : 'upcoming'
          const isLast = i === total - 1

          return (
            <Fragment key={step.label}>
              <li className="flex flex-col items-center w-20 flex-shrink-0">
                <StepCircle state={state} number={i + 1} />
                <span
                  className={`text-xs mt-2 text-center leading-tight transition-colors ${
                    state === 'current'
                      ? 'font-medium text-slate-900'
                      : state === 'completed'
                        ? 'font-normal text-slate-700'
                        : 'font-normal text-slate-400'
                  }`}
                  style={{ fontFamily: 'var(--font-heading-var)' }}
                >
                  {step.label}
                </span>
              </li>
              {!isLast && (
                <li
                  aria-hidden="true"
                  className="h-0.5 flex-1 mt-[18px] transition-colors duration-300"
                  style={{
                    background: i < safeCurrent ? 'var(--navy-dark)' : 'var(--border-subtle)',
                  }}
                />
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

function StepCircle({ state, number }: { state: 'completed' | 'current' | 'upcoming'; number: number }) {
  if (state === 'completed') {
    return (
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white transition-colors"
        style={{ background: 'var(--navy-dark)' }}
        aria-current="false"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-semibold transition-colors"
        style={{
          background: 'var(--navy-dark)',
          fontFamily: 'var(--font-heading-var)',
          boxShadow: '0 0 0 4px rgba(17, 29, 53, 0.12)',
        }}
        aria-current="step"
      >
        {number}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border text-sm font-medium transition-colors"
      style={{
        borderColor: 'var(--border-medium)',
        color: 'var(--text-tertiary)',
        background: 'var(--bg-card)',
        fontFamily: 'var(--font-heading-var)',
      }}
    >
      {number}
    </span>
  )
}
