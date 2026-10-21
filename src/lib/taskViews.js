import { dateKey } from '@/lib/stats'

// The smart lists shown as tiles on the dashboard. One definition is shared by the tile
// counts and the filtered task list, so the number on a tile always matches what you see.
export const TASK_VIEWS = {
  today: { label: 'Due today' },
  scheduled: { label: 'Scheduled' },
  open: { label: 'All open' },
  overdue: { label: 'Overdue' },
  completed: { label: 'Completed' }
}

export function matchesView(task, view, now = new Date()) {
  const done = task.status === 'done'
  const due = task.due_at ? new Date(task.due_at) : null
  switch (view) {
    case 'today':
      return !done && !!due && dateKey(due) === dateKey(now)
    case 'scheduled':
      return !done && !!due
    case 'open':
      return !done
    case 'overdue':
      return !done && !!due && due < now
    case 'completed':
      return done
    default:
      return true
  }
}

export function countViews(tasks, now = new Date()) {
  const counts = Object.fromEntries(Object.keys(TASK_VIEWS).map((v) => [v, 0]))
  for (const task of tasks) {
    for (const view of Object.keys(TASK_VIEWS)) if (matchesView(task, view, now)) counts[view]++
  }
  return counts
}
