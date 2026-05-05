import type { CSSProperties } from 'react'

export interface SkeletonProps {
  /** Tailwind classes for sizing — width/height/rounding. Defaults to a 1-line bar. */
  className?: string
  /** Inline width override (e.g. '80%'). */
  width?: string | number
  /** Inline height override (e.g. '16px'). */
  height?: string | number
  /** Disable the shimmer animation (useful for the static-state visual regression page). */
  static?: boolean
}

/**
 * Loading-state placeholder. Reuses the .animate-shimmer keyframe defined
 * in globals.css (linear gradient sweep over slate tones, 1.5s loop).
 *
 * Default class produces a single 14px bar; pass className for custom
 * shapes (rounded-full for avatars, h-32 for cards, etc.).
 */
export function Skeleton({ className, width, height, static: isStatic }: SkeletonProps) {
  const style: CSSProperties = {}
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height

  const animationClass = isStatic ? 'bg-slate-100' : 'animate-shimmer'

  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      style={style}
      className={[animationClass, 'rounded h-3.5', className ?? ''].filter(Boolean).join(' ')}
    />
  )
}
