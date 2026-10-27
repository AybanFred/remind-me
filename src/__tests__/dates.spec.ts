import { describe, it, expect } from 'vitest'
import {
  defaultTimeFor,
  duePresets,
  formatDueLabel,
  isoToLocalInput,
  localInputToIso,
  toLocalInput
} from '../lib/dates'

// Wednesday 21 Oct 2026, 3pm local time
const wednesday = new Date(2026, 9, 21, 15, 0)
const presetsAt = (now: Date) =>
  Object.fromEntries(
    duePresets(now).map((p: { key: string; label: string; date: Date }) => [
      p.key,
      { label: p.label, value: toLocalInput(p.date) }
    ])
  )

describe('toLocalInput', () => {
  it('writes the local date and time the way <input type="datetime-local"> does', () => {
    expect(toLocalInput(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05T07:03')
  })

  it('round-trips through the ISO timestamp Supabase stores', () => {
    expect(isoToLocalInput(localInputToIso('2026-10-21T14:30'))).toBe('2026-10-21T14:30')
    expect(isoToLocalInput(null)).toBe('')
    expect(localInputToIso('')).toBeNull()
  })
})

describe('duePresets', () => {
  it('offers this evening, tomorrow morning, Saturday and next Monday', () => {
    expect(presetsAt(wednesday)).toEqual({
      today: { label: 'Today', value: '2026-10-21T18:00' },
      tomorrow: { label: 'Tomorrow', value: '2026-10-22T09:00' },
      weekend: { label: 'This weekend', value: '2026-10-24T10:00' },
      next_week: { label: 'Next week', value: '2026-10-26T09:00' }
    })
  })

  it('moves "Today" two hours ahead once the evening is close', () => {
    expect(presetsAt(new Date(2026, 9, 21, 17, 30)).today!.value).toBe('2026-10-21T19:00')
  })

  it('leaves "Today" out late at night', () => {
    expect(presetsAt(new Date(2026, 9, 21, 22, 30)).today).toBeUndefined()
  })

  it('points at the following weekend when it is already the weekend', () => {
    const saturday = presetsAt(new Date(2026, 9, 24, 11))
    expect(saturday.weekend).toEqual({ label: 'Next weekend', value: '2026-10-31T10:00' })
    expect(saturday.next_week!.value).toBe('2026-10-26T09:00')

    const sunday = presetsAt(new Date(2026, 9, 25, 11))
    expect(sunday.weekend!.value).toBe('2026-10-31T10:00')
    expect(sunday.next_week!.value).toBe('2026-10-26T09:00')
  })

  it('means the Monday after this one when it is Monday', () => {
    expect(presetsAt(new Date(2026, 9, 26, 8)).next_week!.value).toBe('2026-11-02T09:00')
  })
})

describe('defaultTimeFor', () => {
  it('uses 9 AM for any other day, or today before 9', () => {
    expect(defaultTimeFor('2026-10-23', wednesday)).toBe('09:00')
    expect(defaultTimeFor('2026-10-21', new Date(2026, 9, 21, 8, 15))).toBe('09:00')
  })

  it('uses the next full hour once 9 AM has passed today', () => {
    expect(defaultTimeFor('2026-10-21', new Date(2026, 9, 21, 14, 20))).toBe('15:00')
    expect(defaultTimeFor('2026-10-21', new Date(2026, 9, 21, 23, 10))).toBe('23:59')
  })
})

describe('formatDueLabel', () => {
  it('says Today, Tomorrow or Yesterday for the nearest days', () => {
    expect(formatDueLabel('2026-10-21T18:00', wednesday)).toMatch(/^Today, /)
    expect(formatDueLabel('2026-10-22T09:00', wednesday)).toMatch(/^Tomorrow, /)
    expect(formatDueLabel('2026-10-20T09:00', wednesday)).toMatch(/^Yesterday, /)
  })

  it('adds the year only when it is not this year', () => {
    expect(formatDueLabel('2026-12-01T09:00', wednesday)).not.toContain('2026')
    expect(formatDueLabel('2027-01-04T09:00', wednesday)).toContain('2027')
  })
})
