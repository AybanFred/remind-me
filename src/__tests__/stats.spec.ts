import { describe, it, expect } from 'vitest'
import {
  calcStreak,
  completedThisWeek,
  focusMinutesPerDay,
  formatMinutes,
  startOfWeek
} from '../lib/stats'

// Wednesday 21 Oct 2026, 3pm local time
const today = new Date(2026, 9, 21, 15, 0)

describe('calcStreak', () => {
  it('counts consecutive days ending today', () => {
    const days = new Set(['2026-10-21', '2026-10-20', '2026-10-19'])
    expect(calcStreak(days, today)).toBe(3)
  })

  it('keeps the streak alive when today has no activity yet', () => {
    const days = new Set(['2026-10-20', '2026-10-19'])
    expect(calcStreak(days, today)).toBe(2)
  })

  it('stops at the first gap', () => {
    const days = new Set(['2026-10-21', '2026-10-19'])
    expect(calcStreak(days, today)).toBe(1)
  })

  it('is 0 when yesterday and today are both empty', () => {
    expect(calcStreak(new Set(['2026-10-18']), today)).toBe(0)
  })
})

describe('startOfWeek', () => {
  it('returns Monday for a midweek date', () => {
    expect(startOfWeek(today).getDate()).toBe(19)
  })

  it('treats Sunday as the end of the week, not the start', () => {
    const sunday = new Date(2026, 9, 25, 10, 0)
    expect(startOfWeek(sunday).getDate()).toBe(19)
  })
})

describe('completedThisWeek', () => {
  it('only counts tasks completed since Monday, per category', () => {
    const tasks = [
      { category: 'upskilling', completed_at: new Date(2026, 9, 20, 9).toISOString() },
      { category: 'upskilling', completed_at: new Date(2026, 9, 19, 9).toISOString() },
      { category: 'daily', completed_at: new Date(2026, 9, 18, 9).toISOString() }, // last Sunday
      { category: 'job_hunt', completed_at: null }
    ]
    expect(completedThisWeek(tasks, today)).toEqual({ upskilling: 2, job_hunt: 0, daily: 0 })
  })
})

describe('focusMinutesPerDay', () => {
  it('returns 7 days, oldest first, with zeros for empty days', () => {
    const sessions = [
      { started_at: new Date(2026, 9, 21, 10).toISOString(), minutes_focused: 25 },
      { started_at: new Date(2026, 9, 21, 14).toISOString(), minutes_focused: 25 },
      { started_at: new Date(2026, 9, 19, 9).toISOString(), minutes_focused: 10 },
      { started_at: new Date(2026, 8, 1, 9).toISOString(), minutes_focused: 99 } // too old
    ]
    const result = focusMinutesPerDay(sessions, 7, today)
    expect(result).toHaveLength(7)
    expect(result[6].key).toBe('2026-10-21')
    expect(result.map((d) => d.minutes)).toEqual([0, 0, 0, 0, 10, 0, 50])
  })
})

describe('formatMinutes', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(40)).toBe('40m')
    expect(formatMinutes(85)).toBe('1h 25m')
    expect(formatMinutes(120)).toBe('2h')
  })
})
