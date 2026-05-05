import { notFound } from 'next/navigation'
import Showcase from './Showcase'

/**
 * Visual regression page — renders every src/components/ui/* primitive
 * in every state on a single page. The post-Phase-1 visual baseline is
 * captured against this surface; subsequent phases run a Playwright
 * spec that diffs against the baseline screenshot to detect regressions.
 *
 * Gated by NEXT_PUBLIC_DEV_TOOLS=1 to keep the route invisible in
 * production. The env var is read server-side here so notFound() can
 * fire cleanly at the route level — no client-side flicker.
 */
export default function DevComponentsPage() {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== '1') {
    notFound()
  }
  return <Showcase />
}

export const metadata = {
  title: 'SchoolLaunch — UI primitives',
  description: 'Visual regression target for Phase 1 design-system primitives.',
}
