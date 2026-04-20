import { test, expect } from '@playwright/test'
import Anthropic from '@anthropic-ai/sdk'
import { withRetry, AIUnavailableError } from '../../src/lib/anthropic-client'

/**
 * Suite 8 — Anthropic retry/backoff wrapper (Session 4, Track B2, AUDIT 5.5).
 *
 * Exercises the policy described in src/lib/anthropic-client.ts without
 * going over the network. We pass a fake sleep hook to collect the delays
 * the wrapper would have slept, and throw shaped errors by hand.
 */

// Minimal fake mirroring Anthropic.APIError's shape. The wrapper's retry
// detection checks `err instanceof Anthropic.APIError`, so we extend it.
class FakeAPIError extends Anthropic.APIError {
  constructor(status: number, headers?: Record<string, string>) {
    // APIError constructor signature: (status, error, message, headers)
    const h = headers ? new Headers(headers) : undefined
    super(status, undefined, `fake ${status}`, h as unknown as Headers)
  }
}

function collectSleeps() {
  const sleeps: number[] = []
  return {
    sleeps,
    sleep: async (ms: number) => {
      sleeps.push(ms)
    },
  }
}

test.describe('Suite 8 — Anthropic retry wrapper', () => {
  test('429 with retry-after header honored (override backoff) → retry succeeds', async () => {
    const { sleeps, sleep } = collectSleeps()
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        if (calls === 1) throw new FakeAPIError(429, { 'retry-after': '3' })
        return 'ok'
      },
      { sleep },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(2)
    // retry-after: 3 seconds → 3000ms (NOT the default 1000ms first backoff).
    expect(sleeps).toEqual([3000])
  })

  test('retry-after-ms header takes precedence over retry-after', async () => {
    const { sleeps, sleep } = collectSleeps()
    let calls = 0
    await withRetry(
      async () => {
        calls++
        if (calls === 1) {
          throw new FakeAPIError(429, { 'retry-after-ms': '1500', 'retry-after': '10' })
        }
        return 'ok'
      },
      { sleep },
    )
    expect(sleeps).toEqual([1500])
  })

  test('three consecutive 529 responses exhaust retries and throw AIUnavailableError', async () => {
    const { sleeps, sleep } = collectSleeps()
    let calls = 0
    let caught: unknown
    try {
      await withRetry(
        async () => {
          calls++
          throw new FakeAPIError(529)
        },
        { sleep },
      )
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AIUnavailableError)
    expect((caught as AIUnavailableError).status).toBe(529)
    expect((caught as AIUnavailableError).attempts).toBe(4) // 1 initial + 3 retries
    expect(calls).toBe(4)
    // We should have slept exactly 3 times (between the 4 attempts). No
    // retry-after headers → base backoff 1000/2000/4000 each with ±20% jitter.
    expect(sleeps).toHaveLength(3)
    const bases = [1000, 2000, 4000]
    sleeps.forEach((s, i) => {
      expect(s).toBeGreaterThanOrEqual(bases[i] * 0.8)
      expect(s).toBeLessThanOrEqual(bases[i] * 1.2)
    })
  })

  test('4xx non-retryable (400) throws immediately — no retries', async () => {
    const { sleeps, sleep } = collectSleeps()
    let calls = 0
    let caught: unknown
    try {
      await withRetry(
        async () => {
          calls++
          throw new FakeAPIError(400)
        },
        { sleep },
      )
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AIUnavailableError)
    expect((caught as AIUnavailableError).status).toBe(400)
    expect(calls).toBe(1)
    expect(sleeps).toEqual([])
  })

  test('422 Unprocessable is not retried', async () => {
    const { sleep } = collectSleeps()
    let calls = 0
    try {
      await withRetry(async () => { calls++; throw new FakeAPIError(422) }, { sleep })
    } catch { /* expected */ }
    expect(calls).toBe(1)
  })

  test('connection errors are retried', async () => {
    const { sleeps, sleep } = collectSleeps()
    let calls = 0
    // APIConnectionError surface from the SDK
    const connErr = new Anthropic.APIConnectionError({ cause: new Error('ECONNREFUSED') })
    const result = await withRetry(
      async () => {
        calls++
        if (calls < 3) throw connErr
        return 'ok'
      },
      { sleep },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(3)
    expect(sleeps).toHaveLength(2)
  })

  test('succeeds on first try with no sleeps', async () => {
    const { sleeps, sleep } = collectSleeps()
    const r = await withRetry(async () => 'ok', { sleep })
    expect(r).toBe('ok')
    expect(sleeps).toEqual([])
  })

  test('500/502/503/504 are each retried', async () => {
    for (const status of [500, 502, 503, 504]) {
      const { sleep } = collectSleeps()
      let calls = 0
      const r = await withRetry(
        async () => {
          calls++
          if (calls === 1) throw new FakeAPIError(status)
          return 'ok'
        },
        { sleep },
      )
      expect(r).toBe('ok')
      expect(calls).toBe(2)
    }
  })

  test('AIUnavailableError includes cause, status, and attempt count', async () => {
    const { sleep } = collectSleeps()
    const origErr = new FakeAPIError(503)
    let caught: AIUnavailableError | undefined
    try {
      await withRetry(async () => { throw origErr }, { sleep, maxRetries: 1 })
    } catch (err) {
      caught = err as AIUnavailableError
    }
    expect(caught).toBeDefined()
    expect(caught!.name).toBe('AIUnavailableError')
    expect(caught!.status).toBe(503)
    expect(caught!.attempts).toBe(2)
    expect(caught!.cause).toBe(origErr)
  })
})
