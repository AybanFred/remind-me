// Decides WHICH tasks deserve a notification right now. No browser APIs in here,
// so it is easy to test. The store (stores/reminders.js) does the actual notifying.

export const LEAD_MINUTES = 15 // warn this long before a task is due

// Returns [{ task, kind: 'soon' | 'overdue', key }] for tasks we haven't notified about yet.
// `key` identifies one specific reminder. It includes the due date, so if you move a
// task's due date you get reminded again, but the same reminder never fires twice.
export function findReminders(tasks, notifiedKeys, now = new Date()) {
  const reminders = []
  for (const task of tasks) {
    if (!task.due_at || task.status === 'done') continue

    const minutesLeft = (new Date(task.due_at) - now) / 60000
    let kind = null
    if (minutesLeft <= 0) kind = 'overdue'
    else if (minutesLeft <= LEAD_MINUTES) kind = 'soon'
    if (!kind) continue

    const key = `${task.id}|${kind}|${task.due_at}`
    if (!notifiedKeys.has(key)) reminders.push({ task, kind, key })
  }
  return reminders
}
