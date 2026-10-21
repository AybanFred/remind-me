import { describe, it, expect } from 'vitest'
import { countViews, matchesView } from '../lib/taskViews'

// Wednesday 21 Oct 2026, 3pm
const now = new Date(2026, 9, 21, 15, 0)
const due = (d: number, h: number) => new Date(2026, 9, d, h).toISOString()
const task = (due_at: string | null, status = 'todo') => ({ due_at, status })

describe('matchesView', () => {
  it('"today" includes tasks due later today and earlier today, but not done ones', () => {
    expect(matchesView(task(due(21, 18)), 'today', now)).toBe(true)
    expect(matchesView(task(due(21, 9)), 'today', now)).toBe(true)
    expect(matchesView(task(due(22, 9)), 'today', now)).toBe(false)
    expect(matchesView(task(due(21, 18), 'done'), 'today', now)).toBe(false)
  })

  it('"overdue" is open tasks whose due time has passed', () => {
    expect(matchesView(task(due(21, 9)), 'overdue', now)).toBe(true)
    expect(matchesView(task(due(21, 18)), 'overdue', now)).toBe(false)
    expect(matchesView(task(null), 'overdue', now)).toBe(false)
  })

  it('"scheduled" is any open task with a due date', () => {
    expect(matchesView(task(due(30, 9)), 'scheduled', now)).toBe(true)
    expect(matchesView(task(null), 'scheduled', now)).toBe(false)
  })

  it('an unknown view matches everything', () => {
    expect(matchesView(task(null, 'done'), 'any', now)).toBe(true)
  })
})

describe('countViews', () => {
  it('counts each smart list', () => {
    const tasks = [
      task(due(21, 9)), // today + overdue + scheduled + open
      task(due(25, 9)), // scheduled + open
      task(null), // open
      task(null, 'done') // completed
    ]
    expect(countViews(tasks, now)).toEqual({ today: 1, scheduled: 2, open: 3, overdue: 1, completed: 1 })
  })
})
