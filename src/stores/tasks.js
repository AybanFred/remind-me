import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const UNDO_MS = 5000

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    filter: 'all', // 'all' | 'upskilling' | 'job_hunt' | 'daily'
    loading: false,
    error: ''
  }),

  getters: {
    filteredTasks: (state) =>
      state.filter === 'all' ? state.tasks : state.tasks.filter((t) => t.category === state.filter)
  },

  actions: {
    async fetchTasks() {
      this.loading = true
      this.error = ''
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) this.error = error.message
      else this.tasks = data
      this.loading = false
    },

    async addTask({ title, notes, category, due_at }) {
      const auth = useAuthStore()
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: auth.user.id,
          title,
          notes,
          category,
          due_at,
          status: 'todo',
          position: 0 // Phase 3 (Kanban) will set real positions
        })
        .select()
        .single()
      if (error) throw error
      this.tasks.unshift(data)
    },

    // Adds several tasks in ONE request (used when accepting the AI coach's suggestions).
    async addTasks(list) {
      const auth = useAuthStore()
      const rows = list.map(({ title, notes, category }) => ({
        user_id: auth.user.id,
        title,
        notes,
        category,
        status: 'todo',
        position: 0
      }))
      const { data, error } = await supabase.from('tasks').insert(rows).select()
      if (error) throw error
      this.tasks.unshift(...data)
    },

    async updateTask(id, changes) {
      const { data, error } = await supabase
        .from('tasks')
        .update(changes)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const index = this.tasks.findIndex((t) => t.id === id)
      this.tasks[index] = data
    },

    // Checking a task marks it done; unchecking sends it back to "todo".
    toggleDone(task) {
      const isDone = task.status === 'done'
      return this.updateTask(task.id, {
        status: isDone ? 'todo' : 'done',
        completed_at: isDone ? null : new Date().toISOString()
      })
    },

    // Called after a drag-and-drop. `ordered` is one Kanban column's tasks in their new
    // order. Each task's position becomes its index, and tasks that arrived from another
    // column get the new status (plus completed_at, to match what the checkbox does).
    async saveColumn(status, ordered) {
      const saves = []
      const completed = [] // tasks that just arrived in the Done column
      ordered.forEach((task, index) => {
        const movedColumn = task.status !== status
        if (!movedColumn && task.position === index) return // nothing changed, skip the request
        if (movedColumn && status === 'done') completed.push(task)

        const changes = { status, position: index }
        if (movedColumn) changes.completed_at = status === 'done' ? new Date().toISOString() : null

        // Update the local copy first so the UI never flickers back to the old order.
        Object.assign(task, changes)
        saves.push(supabase.from('tasks').update(changes).eq('id', task.id))
      })

      const results = await Promise.all(saves)
      const failed = results.find((r) => r.error)
      if (failed) throw failed.error
      return { completed }
    },

    // Deleting is delayed by a few seconds so it can be undone. The task disappears from the
    // screen right away, but only leaves the database once the undo window has passed.
    removeTaskWithUndo(task) {
      const toast = useToastStore()
      const index = this.tasks.findIndex((t) => t.id === task.id)
      this.tasks.splice(index, 1)

      const putBack = () => this.tasks.splice(Math.min(index, this.tasks.length), 0, task)

      const timer = setTimeout(async () => {
        const { error } = await supabase.from('tasks').delete().eq('id', task.id)
        if (error) {
          putBack()
          toast.error(`Could not delete the task: ${error.message}`)
        }
      }, UNDO_MS)

      toast.show('Task deleted', {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          handler: () => {
            clearTimeout(timer)
            putBack()
          }
        }
      })
    }
  }
})
