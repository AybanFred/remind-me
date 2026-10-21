import { defineStore } from 'pinia'

let nextId = 1

// Small pop-up messages ("Task added", "Could not save...") shown by <ToastHost />.
export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [] // { id, message, type: 'success' | 'error' | 'info', action? }
  }),

  actions: {
    // `action` is an optional button, e.g. { label: 'Undo', handler: () => {...} }
    show(message, { type = 'info', duration = 4000, action = null } = {}) {
      const id = nextId++
      this.toasts.push({ id, message, type, action })
      setTimeout(() => this.dismiss(id), duration)
      return id
    },

    success(message, options) {
      return this.show(message, { ...options, type: 'success' })
    },

    error(message, options) {
      // errors stay a bit longer so there is time to read them
      return this.show(message, { duration: 6000, ...options, type: 'error' })
    },

    dismiss(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    }
  }
})
