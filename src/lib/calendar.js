import { dateKey } from '@/lib/stats'

// All the days shown on a month calendar: whole weeks from Monday to Sunday, so it starts with
// the end of the previous month and finishes with the start of the next one where needed.
//   month is 0-11, like JavaScript dates
export function monthGrid(year, month) {
  const first = new Date(year, month, 1, 12) // midday avoids daylight-saving edge cases
  const offset = (first.getDay() + 6) % 7 // days between the Monday and the 1st
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7

  const days = []
  for (let i = 0; i < cells; i++) {
    const date = new Date(year, month, 1 - offset + i, 12)
    days.push({ date, key: dateKey(date), inMonth: date.getMonth() === month })
  }
  return days
}

// Tasks grouped by the local day they are due, earliest first within a day.
export function tasksByDueDay(tasks) {
  const days = new Map()
  for (const task of tasks) {
    if (!task.due_at) continue
    const key = dateKey(new Date(task.due_at))
    if (!days.has(key)) days.set(key, [])
    days.get(key).push(task)
  }
  for (const list of days.values()) list.sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
  return days
}
