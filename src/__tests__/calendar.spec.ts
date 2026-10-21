import { describe, it, expect } from 'vitest'
import { monthGrid, tasksByDueDay } from '../lib/calendar'
import { labelFromKey, slugify } from '../lib/categories'

describe('monthGrid', () => {
  it('starts on the Monday before the 1st and ends on a Sunday', () => {
    // 1 Oct 2026 is a Thursday
    const days = monthGrid(2026, 9)
    expect(days).toHaveLength(35)
    expect(days[0]!.key).toBe('2026-09-28')
    expect(days[3]!.key).toBe('2026-10-01')
    expect(days[34]!.key).toBe('2026-11-01')
  })

  it('marks which days belong to the month', () => {
    const days = monthGrid(2026, 9)
    expect(days.filter((d: { inMonth: boolean }) => d.inMonth)).toHaveLength(31)
    expect(days[0]!.inMonth).toBe(false)
  })

  it('needs only four weeks when a 28-day month starts on a Monday', () => {
    // 1 Feb 2027 is a Monday
    const days = monthGrid(2027, 1)
    expect(days).toHaveLength(28)
    expect(days[0]!.key).toBe('2027-02-01')
  })

  it('uses six weeks when the month needs them', () => {
    // 1 Aug 2026 is a Saturday and August has 31 days
    expect(monthGrid(2026, 7)).toHaveLength(42)
  })
})

describe('tasksByDueDay', () => {
  it('groups by local due day, earliest first, and skips tasks without a due date', () => {
    const tasks = [
      { id: 'late', due_at: new Date(2026, 9, 21, 17).toISOString() },
      { id: 'early', due_at: new Date(2026, 9, 21, 9).toISOString() },
      { id: 'other', due_at: new Date(2026, 9, 22, 9).toISOString() },
      { id: 'none', due_at: null }
    ]
    const days = tasksByDueDay(tasks)
    expect([...days.keys()]).toEqual(['2026-10-21', '2026-10-22'])
    expect(days.get('2026-10-21')!.map((t: { id: string }) => t.id)).toEqual(['early', 'late'])
  })
})

describe('slugify', () => {
  it('turns a label into a safe key', () => {
    expect(slugify('Side projects!')).toBe('side_projects')
    expect(slugify('  Café & Côte  ')).toBe('cafe_cote')
  })

  it('never reuses a taken key', () => {
    expect(slugify('Daily', ['daily'])).toBe('daily_2')
    expect(slugify('Daily', ['daily', 'daily_2'])).toBe('daily_3')
  })

  it('falls back to "category" when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('category')
  })
})

describe('labelFromKey', () => {
  it('makes a readable label for a category that no longer exists', () => {
    expect(labelFromKey('side_projects')).toBe('Side projects')
    expect(labelFromKey(null)).toBe('Uncategorized')
  })
})
