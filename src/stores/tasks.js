import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { matchesView } from '@/lib/taskViews'

const UNDO_MS = 5000

// Subtasks come back inside each task ("embedded"), so one request loads everything.
const WITH_SUBTASKS = '*, subtasks(*)'

// Makes sure a task always has a sorted subtasks list, even when the subtasks table isn't set up yet.
function normalize(task) {
  task.subtasks = [...(task.subtasks ?? [])].sort((a, b) => a.position - b.position)
  return task
}

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    filter: 'all', // 'all' or a category key
    view: 'any', // a smart list from the dashboard tiles: 'today', 'overdue', ... or 'any'
    loading: false,
    error: '',
    // Turns false if the subtasks table has not been created yet, so the rest of the app keeps working.
    subtasksReady: true
  }),

  getters: {
    filteredTasks: (state) => {
      const now = new Date()
      return state.tasks.filter(
        (t) => (state.filter === 'all' || t.category === state.filter) && matchesView(t, state.view, now)
      )
    }
  },

  actions: {
    async fetchTasks() {
      this.loading = true
      this.error = ''
      let { data, error } = await supabase
        .from('tasks')
        .select(WITH_SUBTASKS)
        .order('created_at', { ascending: false })

      // If the subtasks table is missing, load plain tasks instead of breaking the whole list.
      if (error && /subtasks|relationship|schema cache/i.test(error.message)) {
        this.subtasksReady = false
        ;({ data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false }))
      } else {
        this.subtasksReady = true
      }

      if (error) this.error = error.message
      else this.tasks = data.map(normalize)
      this.loading = false
    },

    async addTask({ title, notes, category, due_at, important }) {
      const auth = useAuthStore()
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: auth.user.id,
          title,
          notes,
          category,
          due_at,
          // Left out unless set, so adding tasks still works before the `important` column exists.
          ...(important && { important }),
          status: 'todo',
          position: 0 // Phase 3 (Kanban) will set real positions
        })
        .select(this.columns())
        .single()
      if (error) throw error
      this.tasks.unshift(normalize(data))
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
      const { data, error } = await supabase.from('tasks').insert(rows).select(this.columns())
      if (error) throw error
      this.tasks.unshift(...data.map(normalize))
    },

    async updateTask(id, changes) {
      const { data, error } = await supabase
        .from('tasks')
        .update(changes)
        .eq('id', id)
        .select(this.columns())
        .single()
      if (error) throw error
      const index = this.tasks.findIndex((t) => t.id === id)
      this.tasks[index] = normalize(data)
    },

    // Which columns to ask for: with subtasks if the table exists, plain otherwise.
    columns() {
      return this.subtasksReady ? WITH_SUBTASKS : '*'
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

    // ---------- subtasks (an optional checklist inside a task) ----------

    async addSubtask(task, title) {
      const auth = useAuthStore()
      const position = task.subtasks.reduce((max, s) => Math.max(max, s.position), -1) + 1
      const { data, error } = await supabase
        .from('subtasks')
        .insert({ user_id: auth.user.id, task_id: task.id, title: title.trim(), position })
        .select()
        .single()
      if (error) throw error
      task.subtasks.push(data)
    },

    // Ticks instantly on screen and saves in the background; goes back if the save fails.
    async toggleSubtask(subtask) {
      const done = !subtask.done
      subtask.done = done
      const { error } = await supabase.from('subtasks').update({ done }).eq('id', subtask.id)
      if (error) {
        subtask.done = !done
        throw error
      }
    },

    async renameSubtask(subtask, title) {
      const { data, error } = await supabase
        .from('subtasks')
        .update({ title: title.trim() })
        .eq('id', subtask.id)
        .select()
        .single()
      if (error) throw error
      subtask.title = data.title
    },

    async removeSubtask(task, subtask) {
      const { error } = await supabase.from('subtasks').delete().eq('id', subtask.id)
      if (error) throw error
      task.subtasks = task.subtasks.filter((s) => s.id !== subtask.id)
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
