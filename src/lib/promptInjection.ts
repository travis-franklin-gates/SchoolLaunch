/**
 * Prompt-injection pre-flight scanner. Pattern-matches known override shapes
 * against untrusted user input before it reaches the model. Non-blocking by
 * design — the caller decides whether to proceed.
 *
 * Patterns intentionally err on the side of recall over precision. A legitimate
 * narrative that mentions "ignore previous instructions" inside a quoted
 * discussion of AI policy will match — that's why this is non-blocking and
 * surfaces as a warning rather than a hard reject.
 */

export interface InjectionScanResult {
  suspected: boolean
  /** Human-readable pattern labels that matched. */
  patterns: string[]
}

interface Pattern {
  label: string
  regex: RegExp
}

const PATTERNS: Pattern[] = [
  {
    label: 'ignore_prior_instructions',
    regex: /ignore\s+(?:(?:all|any|previous|prior|earlier|the)\s+){0,3}(?:above\s+)?(?:instructions?|prompts?|rules?|directives?)/i,
  },
  {
    label: 'disregard_above',
    regex: /disregard\s+(?:(?:the|all|any)\s+){0,2}(?:above|previous|prior|preceding|system|earlier)/i,
  },
  {
    label: 'role_override',
    regex: /you\s+are\s+now\s+(?:a\s+|an\s+)?(?:\w+\s+){0,3}(?:assistant|model|agent|bot|ai|chatbot|system|admin|developer)/i,
  },
  {
    label: 'new_instructions',
    regex: /\bnew\s+(?:instructions?|tasks?|roles?|prompts?|objectives?|directives?)\b/i,
  },
  {
    label: 'leading_system_role',
    regex: /(?:^|\n)\s*(?:system|assistant|user)\s*:/i,
  },
  {
    label: 'jailbreak_mode',
    regex: /\b(?:DAN\s*mode|developer\s*mode|jailbreak|unrestricted\s*mode|unfiltered\s*mode)\b/i,
  },
  {
    label: 'unrestricted_claim',
    regex: /\b(?:without\s+restrictions?|no\s+restrictions?|no\s+limitations?|act\s+unrestricted)\b/i,
  },
  {
    label: 'override_system_prompt',
    regex: /\b(?:override|bypass|forget|erase|reset|ignore)\s+(?:your\s+|the\s+|all\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|guidelines?)\b/i,
  },
  {
    label: 'force_output',
    regex: /\b(?:respond|reply|answer|output|print|say)\s+(?:only\s+|exactly\s+|just\s+)?(?:with\s+)?["']?(?:APPROVED|ACCEPTED|YES|PASS|SUCCESS|strong|fully\s+aligned)["']?/i,
  },
]

export function scanForInjection(text: string): InjectionScanResult {
  if (!text) return { suspected: false, patterns: [] }
  const matches: string[] = []
  for (const p of PATTERNS) {
    if (p.regex.test(text)) matches.push(p.label)
  }
  return { suspected: matches.length > 0, patterns: matches }
}
