import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { calcStreak, completedThisWeek, dateKey, focusMinutesPerDay } from '@/lib/stats'
import { levelProgress, XP_PER_TASK } from '@/lib/rewards'

export const useStatsStore = defineStore('stats', {
  state: () => ({
    completedTasks: [], // { category, completed_at } for every finished task
    sessions: [], // { started_at, minutes_focused } for every focus session
    loading: false,
    error: ''
  }),

  getters: {
    streak(state) {
      const activeDays = new Set([
        ...state.completedTasks.map((t) => dateKey(new Date(t.completed_at))),
        ...state.sessions.map((s) => dateKey(new Date(s.started_at)))
      ])
      return calcStreak(activeDays)
    },
    weekByCategory: (state) => completedThisWeek(state.completedTasks),
    weekTotal() {
      return Object.values(this.weekByCategory).reduce((sum, n) => sum + n, 0)
    },
    last7Days: (state) => focusMinutesPerDay(state.sessions, 7),

    // 10 XP per completed task plus 1 XP per focus minute, worked out from the same data as everything else.
    xp: (state) =>
      state.completedTasks.length * XP_PER_TASK +
      state.sessions.reduce((sum, s) => sum + s.minutes_focused, 0),
    level() {
      return levelProgress(this.xp)
    }
  },

  actions: {
    // Two small queries - we only download the columns the dashboard needs.
    async fetchStats() {
      this.loading = true
      this.error = ''
      const [tasks, sessions] = await Promise.all([
        supabase.from('tasks').select('category, completed_at').not('completed_at', 'is', null),
        supabase.from('focus_sessions').select('started_at, minutes_focused')
      ])
      const error = tasks.error ?? sessions.error
      if (error) this.error = error.message
      else {
        this.completedTasks = tasks.data
        this.sessions = sessions.data
      }
      this.loading = false
    }
  }
})
