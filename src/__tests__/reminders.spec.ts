import { describe, it, expect } from 'vitest'
import { findReminders } from '../lib/reminders'

const now = new Date(2026, 9, 21, 15, 0)
const minutesFromNow = (m: number) => new Date(now.getTime() + m * 60000).toISOString()
const task = (id: string, due: string | null, status = 'todo') => ({ id, due_at: due, status })

describe('findReminders', () => {
  it('flags a task due within 15 minutes as "soon"', () => {
    const result = findReminders([task('a', minutesFromNow(10))], new Set(), now)
    expect(result.map((r) => r.kind)).toEqual(['soon'])
  })

  it('flags a task past its due time as "overdue"', () => {
    const result = findReminders([task('a', minutesFromNow(-5))], new Set(), now)
    expect(result.map((r) => r.kind)).toEqual(['overdue'])
  })

  it('ignores tasks due later, without a due date, or already done', () => {
    const tasks = [
      task('later', minutesFromNow(60)),
      task('none', null),
      task('done', minutesFromNow(-5), 'done')
    ]
    expect(findReminders(tasks, new Set(), now)).toEqual([])
  })

  it('does not repeat a reminder that was already sent', () => {
    const t = task('a', minutesFromNow(10))
    const first = findReminders([t], new Set(), now)
    expect(findReminders([t], new Set([first[0]!.key]), now)).toEqual([])
  })

  it('reminds again when the due date changes', () => {
    const original = task('a', minutesFromNow(10))
    const sent = new Set([findReminders([original], new Set(), now)[0]!.key])
    const rescheduled = task('a', minutesFromNow(12))
    expect(findReminders([rescheduled], sent, now)).toHaveLength(1)
  })
})
