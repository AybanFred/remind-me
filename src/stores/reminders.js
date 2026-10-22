import { defineStore } from 'pinia'
import { findReminders } from '@/lib/reminders'
import { useTasksStore } from '@/stores/tasks'
import { useNotificationsStore } from '@/stores/notifications'
import { formatDue } from '@/lib/dates'

const CHECK_EVERY_MS = 30 * 1000
const MAX_INDIVIDUAL = 3 // more than this at once -> send one summary instead of a pile
const KEYS_STORAGE = 'notifiedReminders'
const ENABLED_STORAGE = 'remindersEnabled'
const DISMISSED_STORAGE = 'reminderPromptDismissed'

let intervalId = null
let checking = false // stops two checks running at once and sending the same reminder twice

// localStorage can throw (private mode, storage disabled), so wrap it.
function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* not critical */
  }
}

function loadNotifiedKeys() {
  try {
    return new Set(JSON.parse(read(KEYS_STORAGE) ?? '[]'))
  } catch {
    return new Set()
  }
}

// Returns true if the browser accepted the notification, false if it didn't.
async function notify(title, body, tag) {
  try {
    const n = new Notification(title, { body, tag }) // same tag = replaces, never duplicates
    n.onclick = () => {
      window.focus()
      n.close()
    }
    return true
  } catch {
    // Phones don't allow "new Notification()" - they only allow notifications shown by a
    // service worker. The installed PWA has one, so ask it to show the notification instead.
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, { body, tag, icon: '/pwa-192x192.png' })
      return true
    } catch (e) {
      console.warn('[reminders] could not show notification:', e)
      return false
    }
  }
}

export const useRemindersStore = defineStore('reminders', {
  state: () => ({
    // 'default' = never asked, 'granted', 'denied', or 'unsupported'
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    enabled: read(ENABLED_STORAGE) !== 'false', // the on/off switch in the header
    promptDismissed: read(DISMISSED_STORAGE) === 'true'
  }),

  getters: {
    // Should we show the "enable reminders?" banner?
    canAsk: (state) => state.permission === 'default' && !state.promptDismissed
  },

  actions: {
    // Must be called from a button click - browsers ignore (or block) permission
    // requests that fire on page load without any user action.
    async requestPermission() {
      if (this.permission === 'unsupported') return
      this.permission = await Notification.requestPermission()
      if (this.permission === 'granted') {
        this.setEnabled(true)
        this.check()
      }
    },

    dismissPrompt() {
      this.promptDismissed = true
      write(DISMISSED_STORAGE, 'true')
    },

    setEnabled(value) {
      this.enabled = value
      write(ENABLED_STORAGE, String(value))
    },

    // Called when the user logs in. Checks right away, then every 30 seconds.
    start() {
      if (intervalId) return
      const tasks = useTasksStore()
      if (!tasks.tasks.length && !tasks.loading) tasks.fetchTasks()
      this.check()
      intervalId = setInterval(() => this.check(), CHECK_EVERY_MS)
    },

    stop() {
      clearInterval(intervalId)
      intervalId = null
    },

    // The bell's list always gets reminders; system pop-ups only if allowed and switched on.
    async check() {
      if (checking) return
      checking = true
      try {
        this.listDueReminders()
        if (this.permission === 'granted' && this.enabled) await this.sendDueReminders()
      } finally {
        checking = false
      }
    },

    listDueReminders() {
      const notifications = useNotificationsStore()
      if (!notifications.userId) return
      const due = findReminders(useTasksStore().tasks, notifications.seenKeys)
      notifications.add(
        due.map(({ task, kind, key }) => ({
          key,
          kind,
          taskId: task.id,
          title: kind === 'soon' ? `Due soon: ${task.title}` : `Overdue: ${task.title}`,
          body: `${kind === 'soon' ? 'Due' : 'Was due'} ${formatDue(task.due_at)}`
        }))
      )
    },

    async sendDueReminders() {
      const sent = loadNotifiedKeys()
      const due = findReminders(useTasksStore().tasks, sent)
      if (!due.length) return

      console.info(`[reminders] ${due.length} reminder(s) to send`)

      // Only remember reminders the browser actually accepted, so a failed one is retried.
      if (due.length > MAX_INDIVIDUAL) {
        // e.g. you open the app after a week away - don't spam one popup per old task
        if (await notify('Remind Me', `${due.length} tasks are due or overdue.`, 'summary')) {
          due.forEach(({ key }) => sent.add(key))
        }
      } else {
        for (const { task, kind, key } of due) {
          const shown = await notify(
            kind === 'soon' ? `Due soon: ${task.title}` : `Overdue: ${task.title}`,
            `${kind === 'soon' ? 'Due' : 'Was due'} ${formatDue(task.due_at)}`,
            task.id
          )
          if (shown) sent.add(key)
        }
      }

      write(KEYS_STORAGE, JSON.stringify([...sent].slice(-200))) // keep the list from growing forever
    },

    // Used by other features (e.g. the focus timer) to show a notification right now,
    // if the user has allowed notifications.
    async notifyNow(title, body) {
      useNotificationsStore().add([{ kind: 'timer', title, body }])
      if (this.permission !== 'granted' || !this.enabled) return
      await notify(title, body, 'timer')
    },

    // Lets you check that your browser/OS actually show notifications, independent of any task.
    sendTest() {
      return notify('Remind Me', 'Test notification - reminders are working.', 'test')
    }
  }
})
