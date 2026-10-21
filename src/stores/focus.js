import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const DURATIONS = { focus: 25 * 60, break: 5 * 60 } // in seconds

// The interval handle lives outside the store's state because the UI never needs to read it.
let intervalId = null

export const useFocusStore = defineStore('focus', {
  // The timer lives in a store (not in the page) so it keeps running while you
  // switch between the List, Board and Focus pages.
  state: () => ({
    mode: 'focus', // 'focus' | 'break'
    remaining: DURATIONS.focus, // seconds left
    running: false,
    endsAt: 0, // the clock time (ms) when the timer will hit zero
    startedAt: null, // when the current focus session began (ISO string)
    taskId: null, // optional task this session is linked to
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
    start() {
      if (this.running) return
      // A fresh focus session begins when we start from the full time.
      if (this.mode === 'focus' && this.remaining === DURATIONS.focus) {
        this.startedAt = new Date().toISOString()
      }
      // We store the END time and compare against the real clock on every tick.
      // Counting "1 second per tick" would drift when the browser slows down background tabs.
      this.endsAt = Date.now() + this.remaining * 1000
      this.running = true
      intervalId = setInterval(() => this.tick(), 250)
    },

    pause() {
      clearInterval(intervalId)
      this.running = false
      this.updateTitle()
    },

    tick() {
      this.remaining = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000))
      this.updateTitle()
      if (this.remaining === 0) this.finish()
    },

    // The timer reached zero by itself.
    async finish() {
      this.pause()
      if (this.mode === 'focus') {
        await this.saveSession(DURATIONS.focus / 60)
        this.switchTo('break')
      } else {
        this.switchTo('focus')
      }
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
    },

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
      if (error) this.error = `Could not save the session: ${error.message}`
      else this.todaySessions.unshift(data)
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
