import { describe, it, expect } from 'vitest'
import { restoreTimer } from '../lib/timer'

const now = 1_000_000_000_000

describe('restoreTimer', () => {
  it('returns null for missing or broken data', () => {
    expect(restoreTimer(null, now)).toBeNull()
    expect(restoreTimer('nonsense', now)).toBeNull()
    expect(restoreTimer({ mode: 'lunch' }, now)).toBeNull()
  })

  it('keeps a running timer going with the time that is really left', () => {
    const saved = { mode: 'focus', running: true, endsAt: now + 90_000, remaining: 1500, taskId: 'abc' }
    const result = restoreTimer(saved, now)
    expect(result).toMatchObject({ running: true, remaining: 90, finished: false, taskId: 'abc' })
  })

  it('marks a timer that ran out while the page was closed as finished', () => {
    const saved = { mode: 'focus', running: true, endsAt: now - 5_000, remaining: 10 }
    expect(restoreTimer(saved, now)).toMatchObject({ running: false, remaining: 0, finished: true })
  })

  it('restores a paused timer exactly as it was', () => {
    const saved = { mode: 'break', running: false, remaining: 120, startedAt: null }
    expect(restoreTimer(saved, now)).toMatchObject({
      mode: 'break',
      running: false,
      remaining: 120,
      finished: false
    })
  })

  it('never restores more time than the mode allows', () => {
    const saved = { mode: 'break', running: false, remaining: 99_999 }
    expect(restoreTimer(saved, now)?.remaining).toBe(300)
  })

  it('ignores a task id or start time that is not a string', () => {
    const saved = { mode: 'focus', running: false, remaining: 100, taskId: 42, startedAt: 7 }
    expect(restoreTimer(saved, now)).toMatchObject({ taskId: null, startedAt: null })
  })
})
