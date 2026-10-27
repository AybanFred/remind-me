import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { durationSeconds, formatClock, groupByDay } from '@/lib/time'
import { useAuthStore } from '@/stores/auth'
import { useFocusStore } from '@/stores/focus'
import { useToastStore } from '@/stores/toast'

const RECENT_DAYS = 30
const UNDO_MS = 5000
const CURRENCY_KEY = 'timeCurrency'
const MINI_KEY = 'miniTimer'

// The floating mini timer you get by pressing "Minimize" on the Tracker page.
//   open:     shown (on every page, while a timer runs)
//   expanded: showing all the details, rather than shrunk to a small pill
//   pinned:   stays expanded when you click elsewhere or change page
//   corner:   where it sits on the screen, e.g. 'bottom-right'
const MINI_DEFAULTS = { open: false, expanded: true, pinned: false, corner: 'bottom-right' }

// The once-a-second timer that makes the running clock tick lives outside the state.
let tickId = null

function readCurrency() {
  try {
    return localStorage.getItem(CURRENCY_KEY) ?? 'USD'
  } catch {
    return 'USD'
  }
}

function readMini() {
  try {
    return { ...MINI_DEFAULTS, ...JSON.parse(localStorage.getItem(MINI_KEY) ?? '{}') }
  } catch {
    return { ...MINI_DEFAULTS }
  }
}

const byStartDesc = (a, b) => new Date(b.started_at) - new Date(a.started_at)
const byName = (a, b) => a.name.localeCompare(b.name)

export const useTimeStore = defineStore('time', {
  state: () => ({
    projects: [],
    projectTasks: [],
    entries: [], // the last 30 days (plus the running one, however old)
    now: Date.now(), // updated every second while a timer runs, so clocks re-draw
    currency: readCurrency(),
    mini: readMini(),
    loading: false,
    error: ''
  }),

  getters: {
    running: (state) => state.entries.find((e) => !e.ended_at) ?? null,
    activeProjects: (state) => state.projects.filter((p) => !p.archived),
    projectById: (state) => new Map(state.projects.map((p) => [p.id, p])),
    taskById: (state) => new Map(state.projectTasks.map((t) => [t.id, t])),
    tasksOf: (state) => (projectId) => state.projectTasks.filter((t) => t.project_id === projectId),

    elapsed() {
      return this.running ? durationSeconds(this.running, this.now) : 0
    },
    clock() {
      return formatClock(this.elapsed)
    },
    runningProject() {
      return this.running ? (this.projectById.get(this.running.project_id) ?? null) : null
    },
    days: (state) => groupByDay(state.entries, state.now),

    // Seconds logged in a range like rangeFor('today'), counting a running timer up to now.
    secondsIn: (state) => ({ from, to }) =>
      state.entries
        .filter((e) => new Date(e.started_at) >= from && new Date(e.started_at) < to)
        .reduce((sum, e) => sum + durationSeconds(e, state.now), 0)
  },

  actions: {
    // ---------- loading ----------

    // Everything the Time pages need, in four small requests at once.
    async fetchAll() {
      this.loading = true
      this.error = ''
      const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString()
      const [projects, tasks, recent, running] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('project_tasks').select('*').order('created_at'),
        supabase
          .from('time_entries')
          .select('*')
          .gte('started_at', since)
          .order('started_at', { ascending: false })
          .limit(500),
        // A timer left running for over a month would fall outside the list above, so ask for it separately.
        supabase.from('time_entries').select('*').is('ended_at', null).maybeSingle()
      ])

      const failed = [projects, tasks, recent, running].find((r) => r.error)
      if (failed) {
        this.error = failed.error.message
      } else {
        this.projects = projects.data
        this.projectTasks = tasks.data
        const entries = recent.data
        if (running.data && !entries.some((e) => e.id === running.data.id)) entries.push(running.data)
        this.entries = entries.sort(byStartDesc)
      }
      this.loading = false
      this.syncTicker()
    },

    // Forget everything on logout so the next account never sees it.
    clear() {
      clearInterval(tickId)
      tickId = null
      this.$reset()
    },

    // ---------- the running clock ----------

    // Keeps the once-a-second ticker running exactly while a timer is running.
    syncTicker() {
      if (this.running && !tickId) {
        this.now = Date.now()
        tickId = setInterval(() => {
          this.now = Date.now()
          this.updateTitle()
        }, 1000)
      } else if (!this.running && tickId) {
        clearInterval(tickId)
        tickId = null
      }
      this.updateTitle()
    },

    // Shows the running clock in the browser tab (unless the Pomodoro timer is using it).
    updateTitle() {
      if (useFocusStore().running) return
      document.title = this.running
        ? `${this.clock} · ${this.runningProject?.name ?? 'Tracking time'}`
        : 'Remind Me'
    },

    // ---------- entries ----------

    // Starts a timer. If one is already running it is stopped first, like switching tasks in Clockify.
    async start({ description = '', projectId = null, taskId = null } = {}) {
      if (this.running) await this.stop()

      const auth = useAuthStore()
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: auth.user.id,
          description: description.trim(),
          project_id: projectId,
          task_id: taskId,
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        // 23505 = the "one running timer" rule: another device started one in the meantime.
        if (error.code === '23505') {
          await this.fetchAll()
          throw new Error('A timer is already running, maybe on another device. Your list was refreshed.')
        }
        throw error
      }
      this.entries.unshift(data)
      this.syncTicker()
    },

    async stop() {
      const running = this.running
      if (!running) return
      const { data, error } = await supabase
        .from('time_entries')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', running.id)
        .is('ended_at', null) // do nothing if it was already stopped somewhere else
        .select()
        .maybeSingle()
      if (error) throw error
      if (!data) return this.fetchAll() // it had been stopped elsewhere, so just refresh
      this.replaceEntry(data)
      this.syncTicker()
    },

    async addManualEntry({ description, projectId, taskId, startedAt, endedAt }) {
      const auth = useAuthStore()
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: auth.user.id,
          description: description.trim(),
          project_id: projectId,
          task_id: taskId,
          started_at: startedAt,
          ended_at: endedAt
        })
        .select()
        .single()
      if (error) throw error
      this.entries.push(data)
      this.entries.sort(byStartDesc)
    },

    async updateEntry(id, changes) {
      const { data, error } = await supabase
        .from('time_entries')
        .update(changes)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      this.replaceEntry(data)
      this.syncTicker()
    },

    replaceEntry(entry) {
      const index = this.entries.findIndex((e) => e.id === entry.id)
      if (index === -1) this.entries.push(entry)
      else this.entries[index] = entry
      this.entries.sort(byStartDesc)
    },

    // Same idea as deleting a to-do task: it vanishes now and is only really deleted after the undo window.
    removeEntryWithUndo(entry) {
      const toast = useToastStore()
      this.entries = this.entries.filter((e) => e.id !== entry.id)
      this.syncTicker()

      const putBack = () => {
        this.entries.push(entry)
        this.entries.sort(byStartDesc)
        this.syncTicker()
      }

      const timer = setTimeout(async () => {
        const { error } = await supabase.from('time_entries').delete().eq('id', entry.id)
        if (error) {
          putBack()
          toast.error(`Could not delete the entry: ${error.message}`)
        }
      }, UNDO_MS)

      toast.show('Time entry deleted', {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          handler: () => {
            clearTimeout(timer)
            putBack()
          }
        }
      })
    },

    // ---------- projects ----------

    async addProject({ name, client, color, hourlyRate }) {
      const auth = useAuthStore()
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: auth.user.id,
          name: name.trim(),
          client: client.trim() || null,
          color,
          hourly_rate: hourlyRate === '' || hourlyRate === null ? null : Number(hourlyRate)
        })
        .select()
        .single()
      if (error) throw error
      this.projects.push(data)
      this.projects.sort(byName)
      return data
    },

    async updateProject(id, changes) {
      const { data, error } = await supabase.from('projects').update(changes).eq('id', id).select().single()
      if (error) throw error
      this.projects[this.projects.findIndex((p) => p.id === id)] = data
      this.projects.sort(byName)
    },

    async deleteProject(id) {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) {
        // 23503 = the database refused because hours are logged on it
        if (error.code === '23503') {
          throw new Error('This project has time entries, so it cannot be deleted. Archive it instead.')
        }
        throw error
      }
      this.projects = this.projects.filter((p) => p.id !== id)
      this.projectTasks = this.projectTasks.filter((t) => t.project_id !== id) // the database removed these too
    },

    // ---------- tasks inside a project ----------

    async addProjectTask(projectId, name) {
      const auth = useAuthStore()
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({ user_id: auth.user.id, project_id: projectId, name: name.trim() })
        .select()
        .single()
      if (error) throw error
      this.projectTasks.push(data)
    },

    async renameProjectTask(id, name) {
      const { data, error } = await supabase
        .from('project_tasks')
        .update({ name: name.trim() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      this.projectTasks[this.projectTasks.findIndex((t) => t.id === id)] = data
    },

    async deleteProjectTask(id) {
      const { error } = await supabase.from('project_tasks').delete().eq('id', id)
      if (error) throw error
      this.projectTasks = this.projectTasks.filter((t) => t.id !== id)
      // The database keeps the hours but clears their task, so mirror that here.
      this.entries = this.entries.map((e) => (e.task_id === id ? { ...e, task_id: null } : e))
    },

    // ---------- reports ----------

    // Entries inside a date range, for the Reports page (separate from the recent list above).
    async fetchRange(from, to) {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .gte('started_at', from.toISOString())
        .lt('started_at', to.toISOString())
        .order('started_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      return data
    },

    setCurrency(code) {
      this.currency = code
      try {
        localStorage.setItem(CURRENCY_KEY, code)
      } catch {
        /* not critical */
      }
    },

    // ---------- the mini timer ----------

    // Remembered on this device, so it looks the same after a refresh.
    setMini(changes) {
      Object.assign(this.mini, changes)
      try {
        localStorage.setItem(MINI_KEY, JSON.stringify(this.mini))
      } catch {
        /* not critical */
      }
    }
  }
})
