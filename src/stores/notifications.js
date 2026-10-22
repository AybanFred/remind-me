import { defineStore } from 'pinia'
import { addItems } from '@/lib/notifications'

let nextId = Date.now()

// localStorage can throw (private mode, storage disabled), so wrap it.
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* not critical */
  }
}

// The list behind the bell in the top bar. It works even if browser notifications are
// blocked, so you never miss a reminder. Saved per account in this browser.
export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    userId: null,
    items: [], // { id, key, kind: 'soon' | 'overdue' | 'timer' | 'info', title, body, taskId?, createdAt, read }
    // Keys of every reminder ever listed. Kept apart from `items` so clearing the list
    // doesn't bring the same reminders straight back.
    seen: []
  }),

  getters: {
    seenKeys: (state) => new Set(state.seen),
    unreadCount: (state) => state.items.filter((n) => !n.read).length
  },

  actions: {
    load(userId) {
      this.userId = userId
      this.items = read(`notifications:${userId}`)
      this.seen = read(`notificationKeys:${userId}`)
    },

    clear() {
      this.userId = null
      this.items = []
      this.seen = []
    },

    save() {
      if (!this.userId) return
      write(`notifications:${this.userId}`, this.items)
      write(`notificationKeys:${this.userId}`, this.seen)
    },

    // Items with a `key` are listed only once, ever (e.g. one "overdue" per task and due date).
    add(items) {
      const now = new Date().toISOString()
      const seen = this.seenKeys
      const fresh = items
        .filter((n) => !n.key || !seen.has(n.key))
        .map((n) => ({ id: nextId++, createdAt: now, read: false, ...n }))
      if (!fresh.length) return
      this.items = addItems(this.items, fresh)
      const keys = fresh.map((n) => n.key).filter(Boolean)
      this.seen = [...this.seen, ...keys].slice(-200) // keep it from growing forever
      this.save()
    },

    markRead(id) {
      const item = this.items.find((n) => n.id === id)
      if (item && !item.read) {
        item.read = true
        this.save()
      }
    },

    markAllRead() {
      this.items.forEach((n) => (n.read = true))
      this.save()
    },

    remove(id) {
      this.items = this.items.filter((n) => n.id !== id)
      this.save()
    },

    clearAll() {
      this.items = []
      this.save()
    }
  }
})
