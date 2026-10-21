import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { DURATIONS, restoreTimer } from '@/lib/timer'
import { playChime, unlockAudio } from '@/lib/sound'
import { useAuthStore } from '@/stores/auth'
import { useRemindersStore } from '@/stores/reminders'
import { useToastStore } from '@/stores/toast'

const SOUND_KEY = 'focusSound'

// The interval handle lives outside the store's state because the UI never needs to read it.
let intervalId = null

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
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* not critical */
  }
}

export const useFocusStore = defineStore('focus', {
  // The timer lives in a store (not in the page) so it keeps running while you
  // switch between pages, and it is saved to localStorage so it survives a refresh.
  state: () => ({
    mode: 'focus', // 'focus' | 'break'
    remaining: DURATIONS.focus, // seconds left
    running: false,
    endsAt: 0, // the clock time (ms) when the timer will hit zero
    startedAt: null, // when the current focus session began (ISO string)
    taskId: null, // optional task this session is linked to
    soundOn: read(SOUND_KEY) !== 'false',
    todaySessions: [],
    error: ''
  }),

  getters: {
    total: (state) => DURATIONS[state.mode],
    // 0..100, used to draw the circular progress
    percentDone() {
      return Math.round(((this.total - this.remaining) / this.total) * 100)
    },
    display: (state) => {
      const m = String(Math.floor(state.remaining / 60)).padStart(2, '0')
      const s = String(state.remaining % 60).padStart(2, '0')
      return `${m}:${s}`
    },
    todayMinutes: (state) => state.todaySessions.reduce((sum, s) => sum + s.minutes_focused, 0)
  },

  actions: {
    // ---------- saving and restoring ----------

    // Each account gets its own saved timer, so switching accounts never mixes them up.
    storageKey() {
      const userId = useAuthStore().user?.id
      return userId ? `focusTimer:${userId}` : null
    },

    persist() {
      const key = this.storageKey()
      if (!key) return
      write(
        key,
        JSON.stringify({
          mode: this.mode,
          remaining: this.remaining,
          running: this.running,
          endsAt: this.endsAt,
          startedAt: this.startedAt,
          taskId: this.taskId
        })
      )
    },

    // Called right after login (and on every page load while logged in).
    async hydrate() {
      const key = this.storageKey()
      if (!key) return

      let saved = null
      try {
        saved = JSON.parse(read(key) ?? 'null')
      } catch {
        /* corrupt data: treated as "nothing saved" */
      }
      const restored = restoreTimer(saved)
      if (!restored) return

      Object.assign(this, {
        mode: restored.mode,
        remaining: restored.remaining,
        running: restored.running,
        endsAt: restored.endsAt,
        startedAt: restored.startedAt,
        taskId: restored.taskId
      })

      if (restored.finished) {
        await this.finish({ whileAway: true })
      } else if (restored.running) {
        this.startTicking()
      }
      this.updateTitle()
    },

    // Called on logout: forget everything in memory (the saved copy stays for next login).
    clear() {
      clearInterval(intervalId)
      intervalId = null
      this.$reset()
      document.title = 'Remind Me'
    },

    // ---------- the timer ----------

    start() {
      if (this.running) return
      unlockAudio() // we're inside a click here, so the browser lets us prepare sound for later
      // A fresh focus session begins when we start from the full time.
      if (this.mode === 'focus' && this.remaining === DURATIONS.focus) {
        this.startedAt = new Date().toISOString()
      }
      // We store the END time and compare against the real clock on every tick.
      // Counting "1 second per tick" would drift when the browser slows down background tabs.
      this.endsAt = Date.now() + this.remaining * 1000
      this.running = true
      this.startTicking()
      this.persist()
    },

    startTicking() {
      clearInterval(intervalId)
      intervalId = setInterval(() => this.tick(), 250)
    },

    pause() {
      clearInterval(intervalId)
      intervalId = null
      this.running = false
      this.updateTitle()
      this.persist()
    },

    tick() {
      this.remaining = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000))
      this.updateTitle()
      if (this.remaining === 0) this.finish()
    },

    // The timer reached zero (by itself, or while the page was closed).
    async finish({ whileAway = false } = {}) {
      const endedMode = this.mode
      this.pause()
      if (endedMode === 'focus') {
        await this.saveSession(DURATIONS.focus / 60)
        this.switchTo('break')
      } else {
        this.switchTo('focus')
      }
      this.announce(endedMode, whileAway)
    },

    // Sound, vibration, a toast and (if allowed) a system notification.
    announce(endedMode, whileAway) {
      const message =
        endedMode === 'focus'
          ? 'Focus session complete. Time for a 5-minute break.'
          : 'Break is over. Ready for another round?'

      useToastStore().success(whileAway ? `While you were away: ${message}` : message, { duration: 8000 })
      if (whileAway) return

      if (this.soundOn) playChime()
      navigator.vibrate?.([200, 100, 200])
      useRemindersStore().notifyNow('Remind Me', message)
    },

    // "Stop early": save the time we already focused (if at least a minute), then start over.
    async reset() {
      this.pause()
      if (this.mode === 'focus') {
        const minutes = Math.floor((this.total - this.remaining) / 60)
        if (minutes >= 1) await this.saveSession(minutes)
      }
      this.switchTo(this.mode)
    },

    // Used by the Focus / Break tabs.
    async setMode(mode) {
      if (mode === this.mode) return
      await this.reset()
      this.switchTo(mode)
    },

    switchTo(mode) {
      this.mode = mode
      this.remaining = DURATIONS[mode]
      this.startedAt = null
      this.updateTitle()
      this.persist()
    },

    setTask(taskId) {
      this.taskId = taskId
      this.persist()
    },

    toggleSound() {
      this.soundOn = !this.soundOn
      write(SOUND_KEY, String(this.soundOn))
    },

    // ---------- saved sessions ----------

    async saveSession(minutes) {
      this.error = ''
      const auth = useAuthStore()
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: auth.user.id,
          task_id: this.taskId,
          started_at: this.startedAt ?? new Date().toISOString(),
          minutes_focused: minutes
        })
        .select('*, tasks(title)')
        .single()
      if (error) {
        this.error = `Could not save the session: ${error.message}`
        useToastStore().error(this.error)
      } else {
        this.todaySessions.unshift(data)
      }
    },

    async fetchToday() {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*, tasks(title)') // also pull the linked task's title
        .gte('started_at', startOfDay.toISOString())
        .order('started_at', { ascending: false })
      if (error) this.error = error.message
      else this.todaySessions = data
    },

    // Shows the countdown in the browser tab so you can see it from other tabs.
    updateTitle() {
      document.title = this.running
        ? `${this.display} · ${this.mode === 'focus' ? 'Focus' : 'Break'}`
        : 'Remind Me'
    }
  }
})
