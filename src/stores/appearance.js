import { defineStore } from 'pinia'
import {
  applyColors,
  applyFont,
  defaultPrefs,
  loadPrefs,
  sanitize,
  savePrefsLocally
} from '@/lib/appearance'
import { useAuthStore } from '@/stores/auth'

let cloudTimer = null

export const useAppearanceStore = defineStore('appearance', {
  state: () => ({
    prefs: loadPrefs(),
    fontStatus: 'idle', // 'idle' | 'loading' | 'error'
    fontError: ''
  }),

  actions: {
    // Called once when the app starts, so your colours and font are there from the first screen.
    init() {
      this.applyAll()
    },

    // Called after login: settings saved on your account follow you to a new device or browser.
    syncFromAccount() {
      const saved = useAuthStore().user?.user_metadata?.appearance
      if (!saved) return
      this.prefs = sanitize(saved)
      savePrefsLocally(this.prefs)
      this.applyAll()
    },

    applyAll() {
      applyColors(this.prefs)
      this.applyFontPref()
    },

    async applyFontPref() {
      this.fontStatus = this.prefs.font ? 'loading' : 'idle'
      this.fontError = ''
      try {
        await applyFont(this.prefs.font)
        this.fontStatus = 'idle'
      } catch (e) {
        this.fontStatus = 'error'
        this.fontError = e.message
        // the font failed, so go back to the default instead of keeping a name that does not work
        this.prefs.font = null
        await applyFont(null)
        this.persist()
      }
    },

    // Change one or more settings, e.g. set({ primary: '#ff0066' }). Takes effect immediately.
    set(changes) {
      this.prefs = sanitize({ ...this.prefs, ...changes })
      applyColors(this.prefs)
      if ('font' in changes) this.applyFontPref()
      this.persist()
    },

    reset() {
      this.prefs = { ...defaultPrefs }
      this.applyAll()
      this.persist()
    },

    // Saved on this device at once, and on your account a moment later
    // (waiting avoids a request for every tick while dragging a colour picker).
    persist() {
      savePrefsLocally(this.prefs)
      clearTimeout(cloudTimer)
      cloudTimer = setTimeout(() => {
        useAuthStore()
          .updateMetadata({ appearance: this.prefs })
          .catch(() => {}) // the device copy is enough if the account save fails
      }, 800)
    }
  }
})
