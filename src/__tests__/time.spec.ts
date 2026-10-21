import { describe, it, expect } from 'vitest'
import {
  buildCsv,
  decimalHours,
  durationSeconds,
  earnings,
  formatClock,
  formatHours,
  groupByDay,
  rangeFor,
  summarizeByProject
} from '../lib/time'

// Wednesday 21 Oct 2026, 3pm local time
const today = new Date(2026, 9, 21, 15, 0)
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString()
const entry = (over: Record<string, unknown>) => ({
  id: 'e',
  project_id: 'p1',
  task_id: null,
  description: '',
  started_at: at(21, 9),
  ended_at: at(21, 10),
  ...over
})

describe('durationSeconds', () => {
  it('measures a finished entry', () => {
    expect(durationSeconds(entry({}))).toBe(3600)
  })

  it('counts a running entry up to "now"', () => {
    const running = entry({ ended_at: null })
    expect(durationSeconds(running, new Date(2026, 9, 21, 9, 30).getTime())).toBe(1800)
  })

  it('never goes negative', () => {
    expect(durationSeconds(entry({ ended_at: null }), new Date(2026, 9, 21, 8).getTime())).toBe(0)
  })
})

describe('formatting', () => {
  it('formats the running clock', () => {
    expect(formatClock(0)).toBe('0:00:00')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(36000)).toBe('10:00:00')
  })

  it('formats lists and totals', () => {
    expect(formatHours(40)).toBe('40s')
    expect(formatHours(1500)).toBe('25m')
    expect(formatHours(3725)).toBe('1h 02m')
    expect(formatHours(7200)).toBe('2h 00m')
  })

  it('gives decimal hours to two places', () => {
    expect(decimalHours(5400)).toBe(1.5)
    expect(decimalHours(1200)).toBe(0.33)
  })
})

describe('earnings', () => {
  it('multiplies hours by the rate and rounds to cents', () => {
    expect(earnings(5400, 40)).toBe(60)
    expect(earnings(1200, 25)).toBe(8.33)
  })

  it('is null when the project has no rate', () => {
    expect(earnings(3600, null)).toBeNull()
    expect(earnings(3600, undefined)).toBeNull()
  })

  it('treats a rate of 0 as a rate', () => {
    expect(earnings(3600, 0)).toBe(0)
  })
})

describe('groupByDay', () => {
  it('groups by start day, newest first, with daily totals', () => {
    const entries = [
      entry({ id: 'a', started_at: at(20, 9), ended_at: at(20, 10) }),
      entry({ id: 'b', started_at: at(21, 9), ended_at: at(21, 10) }),
      entry({ id: 'c', started_at: at(21, 13), ended_at: at(21, 14, 30) })
    ]
    const days = groupByDay(entries, today.getTime(), today)
    expect(days.map((d) => d.label)).toEqual(['Today', 'Yesterday'])
    expect(days.map((d) => d.seconds)).toEqual([3600 + 5400, 3600])
    expect(days[0]!.entries.map((e: { id: string }) => e.id)).toEqual(['c', 'b'])
  })

  it('keeps an entry that crosses midnight on the day it started', () => {
    const late = entry({ started_at: at(20, 23), ended_at: at(21, 1) })
    const days = groupByDay([late], today.getTime(), today)
    expect(days).toHaveLength(1)
    expect(days[0]!.label).toBe('Yesterday')
    expect(days[0]!.seconds).toBe(7200)
  })
})

describe('summarizeByProject', () => {
  const projects = [
    { id: 'p1', name: 'Website', client: 'Acme', color: '#ff0000', hourly_rate: 40 },
    { id: 'p2', name: 'Internal', client: null, color: '#00ff00', hourly_rate: null }
  ]

  it('totals per project, biggest first, with earnings only where there is a rate', () => {
    const entries = [
      entry({ project_id: 'p1', task_id: 't1' }), // 1h
      entry({ project_id: 'p1', task_id: 't1' }), // 1h
      entry({ project_id: 'p2', started_at: at(21, 11), ended_at: at(21, 11, 30) }),
      entry({ project_id: null, started_at: at(21, 12), ended_at: at(21, 12, 10) })
    ]
    const result = summarizeByProject(entries, projects, today.getTime())
    expect(result.map((r) => [r.name, r.seconds, r.amount])).toEqual([
      ['Website', 7200, 80],
      ['Internal', 1800, null],
      ['No project', 600, null]
    ])
    expect(result[0]!.tasks).toEqual([{ taskId: 't1', seconds: 7200 }])
  })
})

describe('rangeFor', () => {
  it('this week runs Monday to the next Monday', () => {
    const { from, to } = rangeFor('week', today)
    expect([from.getDate(), to.getDate()]).toEqual([19, 26])
  })

  it('last week is the seven days before that', () => {
    const { from, to } = rangeFor('lastWeek', today)
    expect([from.getDate(), to.getDate()]).toEqual([12, 19])
  })

  it('handles months, including the previous one', () => {
    expect(rangeFor('month', today).from.getMonth()).toBe(9)
    expect(rangeFor('month', today).to.getMonth()).toBe(10)
    expect(rangeFor('lastMonth', today).from.getMonth()).toBe(8)
  })

  it('today is exactly one day', () => {
    const { from, to } = rangeFor('today', today)
    expect(to.getTime() - from.getTime()).toBe(24 * 3600 * 1000)
  })

  it('rejects an unknown preset', () => {
    expect(() => rangeFor('decade', today)).toThrow()
  })
})

describe('buildCsv', () => {
  const projectById = new Map([['p1', { name: 'Website, v2', client: 'Acme', hourly_rate: 40 }]])
  const taskById = new Map([['t1', { name: 'Design' }]])
  const lookups = { projectById, taskById } as never

  it('writes a header and one row per entry with quoted commas', () => {
    const csv = buildCsv([entry({ task_id: 't1', description: 'Homepage' })], lookups, today.getTime())
    const [header, row] = csv.split('\r\n')
    expect(header).toBe('Date,Start,End,Hours,Project,Client,Task,Description,Hourly rate,Amount')
    expect(row).toBe('2026-10-21,09:00,10:00,1,"Website, v2",Acme,Design,Homepage,40,40')
  })

  it('doubles quotes inside a cell', () => {
    const csv = buildCsv([entry({ description: 'said "hi"' })], lookups, today.getTime())
    expect(csv).toContain('"said ""hi"""')
  })

  it('stops spreadsheet formulas from running', () => {
    const csv = buildCsv([entry({ description: '=HYPERLINK("http://evil")' })], lookups, today.getTime())
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })

  it('leaves the end empty for a running timer', () => {
    const csv = buildCsv([entry({ ended_at: null })], lookups, new Date(2026, 9, 21, 9, 30).getTime())
    expect(csv.split('\r\n')[1]!.split(',').slice(0, 4)).toEqual(['2026-10-21', '09:00', '', '0.5'])
  })
})
